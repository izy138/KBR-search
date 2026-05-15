"""Shared OpenSearch filter clauses for search and analytics."""

from __future__ import annotations

from fastapi import Query


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


def with_query_filters(body: dict[str, object], filters: list[dict[str, object]]) -> dict[str, object]:
  """Attach a bool filter query to an aggregation-only search body."""
  if not filters:
    return body
  return {**body, "query": {"bool": {"filter": filters}}}
