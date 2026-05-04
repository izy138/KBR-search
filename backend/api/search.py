"""Search API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from .opensearch_client import get_client

router = APIRouter()
INDEX_NAME = "project_data"


@router.get("/")
def search(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=10, ge=1, le=100),
    page: int = Query(default=1, ge=1, description="1-based page index"),
    category: str = Query(default="", description="Filter by category (category.keyword)"),
) -> dict[str, object]:
    client = get_client()
    must: list[dict[str, object]] = []
    if q:
        must.append({"multi_match": {"query": q, "fields": ["*"]}})
    else:
        must.append({"match_all": {}})
    if category:
        must.append({"term": {"category.keyword": category}})
    os_query: dict[str, object] = (
        must[0] if len(must) == 1 else {"bool": {"must": must}}
    )
    from_ = (page - 1) * limit
    response = client.search(
        index=INDEX_NAME,
        body={"from": from_, "size": limit, "query": os_query},
    )

    hits = response.get("hits", {}).get("hits", [])
    results = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total

    return {"query": q, "limit": limit, "total": total_value, "results": results}
