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
) -> dict[str, object]:
    client = get_client()
    query = {"match_all": {}} if not q else {"multi_match": {"query": q, "fields": ["*"]}}
    response = client.search(index=INDEX_NAME, body={"size": limit, "query": query})

    hits = response.get("hits", {}).get("hits", [])
    results = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total

    return {"query": q, "limit": limit, "total": total_value, "results": results}
