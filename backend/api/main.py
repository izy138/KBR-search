"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .analytics import router as analytics_router
from .opensearch_client import get_client
from .search import router as search_router

app = FastAPI(title="KBR Internship API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router, prefix="/search", tags=["search"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])


@app.get("/health")
def health_check() -> dict[str, str]:
    client = get_client()
    opensearch_ok = client.ping()
    return {"status": "ok", "opensearch": "up" if opensearch_ok else "down"}
