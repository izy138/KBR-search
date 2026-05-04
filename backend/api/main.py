"""FastAPI application entrypoint."""

from fastapi import FastAPI

from analytics import router as analytics_router
from search import router as search_router

app = FastAPI(title="KBR Internship API", version="0.1.0")

app.include_router(search_router, prefix="/search", tags=["search"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
