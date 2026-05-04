"""Search API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/")
def search(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=10, ge=1, le=100),
) -> dict[str, object]:
    # Placeholder response while OpenSearch query logic is implemented.
    return {"query": q, "limit": limit, "results": []}
