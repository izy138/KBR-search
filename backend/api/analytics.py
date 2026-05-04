"""Analytics and chart-focused API endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/summary")
def analytics_summary() -> dict[str, object]:
    # Placeholder analytics payload.
    return {
        "total_documents": 0,
        "by_category": [],
        "time_series": [],
    }
