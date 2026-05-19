"""Shared OpenSearch filter clauses for search and analytics."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Query

SEARCH_FIELDS = [
  "PROJECT_TITLE^4",
  "PROJECT_TERMS^2",
  "PI_NAMEs^2",
  "ORG_NAME",
  "IC_NAME",
  "ACTIVITY",
]


def build_project_filters(
  *,
  pi: str = "",
  ic: str = "",
  activity: str = "",
  state: str = "",
  fy_min: int | None = None,
  fy_max: int | None = None,
) -> list[dict[str, object]]:
  """Return non-scoring filter clauses aligned with ``GET /search/``."""
  filters: list[dict[str, object]] = []
  if pi:
    filters.append(
      {
        "bool": {
          "should": [
            {"match_phrase": {"PI_NAMEs": pi}},
            {"match": {"PI_NAMEs": {"query": pi, "operator": "and"}}},
          ],
          "minimum_should_match": 1,
        },
      },
    )
  if ic:
    filters.append({"term": {"IC_NAME.keyword": ic}})
  if activity:
    filters.append({"term": {"ACTIVITY.keyword": activity}})
  if state:
    filters.append({"term": {"ORG_STATE.keyword": state}})
  if fy_min is not None or fy_max is not None:
    range_clause: dict[str, int] = {}
    if fy_min is not None:
      range_clause["gte"] = fy_min
    if fy_max is not None:
      range_clause["lte"] = fy_max
    filters.append({"range": {"FY": range_clause}})
  return filters


def analytics_filter_params(
  pi: str = Query(default="", description="Filter by PI_NAMEs"),
  ic: str = Query(default="", description="Filter by IC_NAME"),
  activity: str = Query(default="", description="Filter by ACTIVITY"),
  state: str = Query(default="", description="Filter by ORG_STATE"),
  fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
  fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
) -> list[dict[str, object]]:
  return build_project_filters(
    pi=pi,
    ic=ic,
    activity=activity,
    state=state,
    fy_min=fy_min,
    fy_max=fy_max,
  )


@dataclass(frozen=True)
class AnalyticsScope:
  """Keyword query plus facet filters for analytics aggregations."""

  filters: list[dict[str, object]]
  q: str


def analytics_scope(
  q: str = Query(default="", description="Keyword search query (same as GET /search/)"),
  pi: str = Query(default="", description="Filter by PI_NAMEs"),
  ic: str = Query(default="", description="Filter by IC_NAME"),
  activity: str = Query(default="", description="Filter by ACTIVITY"),
  state: str = Query(default="", description="Filter by ORG_STATE"),
  fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
  fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
) -> AnalyticsScope:
  return AnalyticsScope(
    filters=build_project_filters(
      pi=pi,
      ic=ic,
      activity=activity,
      state=state,
      fy_min=fy_min,
      fy_max=fy_max,
    ),
    q=q.strip(),
  )


def multi_match_clause(text: str) -> dict[str, object]:
  """Single keyword clause across the standard search fields."""
  return {
    "multi_match": {
      "query": text,
      "fields": SEARCH_FIELDS,
      "type": "best_fields",
      "operator": "and",
    },
  }


def build_keyword_must(q: str) -> list[dict[str, object]]:
  """Return bool ``must`` clauses for dashboard/search keyword queries."""
  stripped = q.strip()
  if not stripped:
    return []
  return [multi_match_clause(stripped)]


MAX_ADVANCED_CLAUSES = 8
MAX_ADVANCED_CLAUSE_LENGTH = 200


def _advanced_clause_bool(text: str, negated: bool) -> dict[str, object]:
  clause = multi_match_clause(text)
  if negated:
    return {"bool": {"must_not": [clause]}}
  return clause


def _combine_advanced(left: dict[str, object], right: dict[str, object], operator: str) -> dict[str, object]:
  if operator == "or":
    return {
      "bool": {
        "should": [left, right],
        "minimum_should_match": 1,
      },
    }
  return {"bool": {"must": [left, right]}}


def build_advanced_keyword_clause(
  clauses: list[dict[str, object]],
  operators: list[str],
) -> dict[str, object] | None:
  """Fold non-empty advanced clauses left-to-right with per-gap AND/OR."""
  parsed: list[tuple[str, bool]] = []
  for raw in clauses:
    if not isinstance(raw, dict):
      continue
    text = str(raw.get("text", "")).strip()
    if not text:
      continue
    if len(text) > MAX_ADVANCED_CLAUSE_LENGTH:
      text = text[:MAX_ADVANCED_CLAUSE_LENGTH]
    negated = bool(raw.get("negated", False))
    parsed.append((text, negated))
  if not parsed:
    return None
  if len(parsed) > MAX_ADVANCED_CLAUSES:
    parsed = parsed[:MAX_ADVANCED_CLAUSES]
  result = _advanced_clause_bool(parsed[0][0], parsed[0][1])
  for index in range(1, len(parsed)):
    op = "and"
    if index - 1 < len(operators):
      candidate = str(operators[index - 1]).strip().lower()
      if candidate == "or":
        op = "or"
    text, negated = parsed[index]
    next_clause = _advanced_clause_bool(text, negated)
    result = _combine_advanced(result, next_clause, op)
  return result


def build_advanced_keyword_must(
  clauses: list[dict[str, object]],
  operators: list[str],
) -> list[dict[str, object]]:
  """Return a single bool ``must`` entry for an advanced keyword query."""
  folded = build_advanced_keyword_clause(clauses, operators)
  if folded is None:
    return []
  return [folded]


def with_query_filters(
  body: dict[str, object],
  filters: list[dict[str, object]],
  q: str = "",
) -> dict[str, object]:
  """Attach keyword query and facet filters to an aggregation-only search body."""
  must = build_keyword_must(q)
  if not must and not filters:
    return body
  bool_query: dict[str, object] = {}
  if must:
    bool_query["must"] = must
  if filters:
    bool_query["filter"] = filters
  return {**body, "query": {"bool": bool_query}}
