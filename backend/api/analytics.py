"""Analytics and chart-focused API endpoints."""

from fastapi import APIRouter

from .opensearch_client import get_client

router = APIRouter()
INDEX_NAME = "project_data"


@router.get("/summary")
def analytics_summary() -> dict[str, object]:
    client = get_client()
    body = {
        "size": 0,
        "aggs": {
            "categories": {"terms": {"field": "category.keyword", "size": 10}},
        },
    }
    response = client.search(index=INDEX_NAME, body=body)

    total = response.get("hits", {}).get("total", {})
    total_documents = total.get("value", 0) if isinstance(total, dict) else total
    buckets = response.get("aggregations", {}).get("categories", {}).get("buckets", [])

    return {
        "total_documents": total_documents,
        "by_category": [{"label": b["key"], "value": b["doc_count"]} for b in buckets],
        "time_series": [],
    }
