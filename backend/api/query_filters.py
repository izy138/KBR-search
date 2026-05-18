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


def build_keyword_must(q: str) -> list[dict[str, object]]:
  """Return bool ``must`` clauses for dashboard/search keyword queries."""
  stripped = q.strip()
  if not stripped:
    return []
  return [
    {
      "multi_match": {
        "query": stripped,
        "fields": SEARCH_FIELDS,
        "type": "best_fields",
        "operator": "and",
      },
    },
  ]


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
