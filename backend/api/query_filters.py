"""Shared OpenSearch filter clauses for search and analytics."""

from __future__ import annotations

import json
from dataclasses import dataclass

from fastapi import HTTPException, Query

SEARCH_FIELDS = [
  "PROJECT_TITLE^4",
  "PROJECT_TERMS^2",
  "ABSTRACT_TEXT",
  "PI_NAMEs^2",
  "ORG_NAME",
  "IC_NAME",
  "ACTIVITY",
]


def build_project_filters(
  *,
  pi: str = "",
  ic: str = "",
  org: str = "",
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
  if org:
    filters.append({"term": {"ORG_NAME.keyword": org}})
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


def normalize_core_num(core: str) -> str:
  return " ".join(core.split()).casefold()


def normalize_recurrence_title(title: str) -> str:
  return " ".join(title.split()).casefold()


def analytics_filter_params(
  pi: str = Query(default="", description="Filter by PI_NAMEs"),
  ic: str = Query(default="", description="Filter by IC_NAME"),
  org: str = Query(default="", description="Filter by ORG_NAME"),
  activity: str = Query(default="", description="Filter by ACTIVITY"),
  state: str = Query(default="", description="Filter by ORG_STATE"),
  fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
  fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
) -> list[dict[str, object]]:
  return build_project_filters(
    pi=pi,
    ic=ic,
    org=org,
    activity=activity,
    state=state,
    fy_min=fy_min,
    fy_max=fy_max,
  )


def parse_advanced_q_param(
  raw: str,
) -> tuple[list[dict[str, object]], list[str]] | None:
  """Parse advanced_q JSON (same shape as GET /search/)."""
  stripped = raw.strip()
  if not stripped:
    return None
  try:
    payload = json.loads(stripped)
  except json.JSONDecodeError as exc:
    raise HTTPException(status_code=400, detail="advanced_q must be valid JSON") from exc
  if not isinstance(payload, dict):
    raise HTTPException(status_code=400, detail="advanced_q must be a JSON object")
  clauses = payload.get("clauses")
  operators = payload.get("operators")
  if not isinstance(clauses, list):
    raise HTTPException(status_code=400, detail="advanced_q.clauses must be an array")
  if not isinstance(operators, list):
    raise HTTPException(status_code=400, detail="advanced_q.operators must be an array")
  normalized_clauses: list[dict[str, object]] = []
  for item in clauses:
    if not isinstance(item, dict):
      continue
    text = item.get("text", "")
    negated = item.get("negated", False)
    normalized_clauses.append(
      {
        "text": str(text) if text is not None else "",
        "negated": bool(negated),
      },
    )
  normalized_operators = [
    op if str(op).strip().lower() == "or" else "and" for op in operators
  ]
  return normalized_clauses, normalized_operators


@dataclass(frozen=True)
class AnalyticsScope:
  """Keyword query plus facet filters for analytics aggregations."""

  filters: list[dict[str, object]]
  q: str
  advanced_clauses: list[dict[str, object]]
  advanced_operators: list[str]


def analytics_scope(
  q: str = Query(default="", description="Keyword search query (same as GET /search/)"),
  advanced_q: str = Query(
    default="",
    description="JSON advanced query: { clauses: [{text, negated}], operators: [and|or] }",
  ),
  pi: str = Query(default="", description="Filter by PI_NAMEs"),
  ic: str = Query(default="", description="Filter by IC_NAME"),
  org: str = Query(default="", description="Filter by ORG_NAME"),
  activity: str = Query(default="", description="Filter by ACTIVITY"),
  state: str = Query(default="", description="Filter by ORG_STATE"),
  fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
  fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
) -> AnalyticsScope:
  parsed_advanced = parse_advanced_q_param(advanced_q) if advanced_q.strip() else None
  adv_clauses: list[dict[str, object]] = []
  adv_operators: list[str] = []
  if parsed_advanced is not None:
    adv_clauses, adv_operators = parsed_advanced
  return AnalyticsScope(
    filters=build_project_filters(
      pi=pi,
      ic=ic,
      org=org,
      activity=activity,
      state=state,
      fy_min=fy_min,
      fy_max=fy_max,
    ),
    q=q.strip(),
    advanced_clauses=adv_clauses,
    advanced_operators=adv_operators,
  )


def analytics_scope_keyword_kwargs(scope: AnalyticsScope) -> dict[str, object]:
  """Keyword arguments for ``with_query_filters`` from an analytics scope."""
  if scope.advanced_clauses:
    return {
      "q": scope.q,
      "advanced_clauses": scope.advanced_clauses,
      "advanced_operators": scope.advanced_operators,
    }
  return {"q": scope.q}


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


def build_keyword_must_clauses(
  q: str = "",
  advanced_clauses: list[dict[str, object]] | None = None,
  advanced_operators: list[str] | None = None,
) -> list[dict[str, object]]:
  """Combine plain and advanced keyword clauses for search/analytics."""
  must: list[dict[str, object]] = []
  if advanced_clauses is not None and advanced_operators is not None:
    must.extend(build_advanced_keyword_must(advanced_clauses, advanced_operators))
  must.extend(build_keyword_must(q))
  return must


def with_query_filters(
  body: dict[str, object],
  filters: list[dict[str, object]],
  q: str = "",
  advanced_clauses: list[dict[str, object]] | None = None,
  advanced_operators: list[str] | None = None,
) -> dict[str, object]:
  """Attach keyword query and facet filters to an aggregation-only search body."""
  must = build_keyword_must_clauses(
    q,
    advanced_clauses=advanced_clauses,
    advanced_operators=advanced_operators,
  )
  if not must and not filters:
    return body
  bool_query: dict[str, object] = {}
  if must:
    bool_query["must"] = must
  if filters:
    bool_query["filter"] = filters
  return {**body, "query": {"bool": bool_query}}
