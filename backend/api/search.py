"""Search API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query

from .opensearch_client import get_client

router = APIRouter()
INDEX_NAME = "project_data"
MAX_RESULT_WINDOW = 10_000


@router.get("/")
def search(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=10, ge=1, le=100),
    page: int = Query(default=1, ge=1, description="1-based page index"),
    category: str = Query(default="", description="Filter by category (category.keyword)"),
    ic: str = Query(default="", description="Filter by IC_NAME"),
    activity: str = Query(default="", description="Filter by ACTIVITY"),
    state: str = Query(default="", description="Filter by ORG_STATE"),
    fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
    fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
    cost_min: float | None = Query(default=None, description="Minimum TOTAL_COST"),
    cost_max: float | None = Query(default=None, description="Maximum TOTAL_COST"),
) -> dict[str, object]:
    client = get_client()
    must: list[dict[str, object]] = []
    filters: list[dict[str, object]] = []
    if q:
        must.append({"multi_match": {"query": q, "fields": ["*"]}})
    else:
        must.append({"match_all": {}})
    if category:
        must.append({"term": {"category.keyword": category}})
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
    if cost_min is not None or cost_max is not None:
        range_clause_cost: dict[str, float] = {}
        if cost_min is not None:
            range_clause_cost["gte"] = cost_min
        if cost_max is not None:
            range_clause_cost["lte"] = cost_max
        filters.append({"range": {"TOTAL_COST": range_clause_cost}})

    if len(must) == 1 and not filters:
        os_query: dict[str, object] = must[0]
    else:
        bool_query: dict[str, object] = {"must": must}
        if filters:
            bool_query["filter"] = filters
        os_query = {"bool": bool_query}
    from_ = (page - 1) * limit
    response = client.search(
        index=INDEX_NAME,
        body={"from": from_, "size": limit, "query": os_query, "track_total_hits": True},
    )

    hits = response.get("hits", {}).get("hits", [])
    results = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total
    visible_total = min(total_value, MAX_RESULT_WINDOW)

    return {
        "query": q,
        "limit": limit,
        "total": total_value,
        "visible_total": visible_total,
        "results": results,
    }


@router.get("/project/{project_id}")
def get_project(project_id: str = Path(..., description="OpenSearch document ID")) -> dict[str, object]:
    client = get_client()
    try:
        response = client.get(index=INDEX_NAME, id=project_id)
    except Exception as exc:
        error_body = getattr(exc, "info", {})
        status_code = error_body.get("status") if isinstance(error_body, dict) else None
        if status_code == 404:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise

    source = response.get("_source", {})
    source["_id"] = response.get("_id")
    return {"project": source}
