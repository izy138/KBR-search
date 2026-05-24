"""FastAPI application entrypoint."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .analytics import router as analytics_router
from .opensearch_client import get_client
from .search import router as search_router

app = FastAPI(title="KBR Internship API", version="0.1.0")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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
