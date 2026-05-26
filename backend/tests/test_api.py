"""Integration tests for core API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
  response = await client.get("/health")
  assert response.status_code == 200
  data = response.json()
  assert data["status"] == "ok"
  assert "opensearch" in data

@pytest.mark.asyncio
async def test_search_returns_results(client: AsyncClient) -> None:
  response = await client.get("/search/", params={"q": "cancer", "limit": 5})
  assert response.status_code == 200
  data = response.json()
  assert "results" in data
  assert isinstance(data["results"], list)


@pytest.mark.asyncio
async def test_search_empty_query(client: AsyncClient) -> None:
  response = await client.get("/search/", params={"q": "", "limit": 5})
  assert response.status_code == 200


@pytest.mark.asyncio
async def test_search_query_too_long(client: AsyncClient) -> None:
  long_query = "a" * 1001
  response = await client.get("/search/", params={"q": long_query})
  assert response.status_code == 400


@pytest.mark.asyncio
async def test_search_invalid_sort_field(client: AsyncClient) -> None:
  response = await client.get("/search/", params={"q": "test", "sort_by": "INVALID_FIELD"})
  assert response.status_code == 400


@pytest.mark.asyncio
async def test_search_pagination(client: AsyncClient) -> None:
  response = await client.get("/search/", params={"q": "research", "limit": 2, "page": 1})
  assert response.status_code == 200
  data = response.json()
  assert "results" in data
  assert len(data["results"]) <= 2


@pytest.mark.asyncio
async def test_analytics_summary(client: AsyncClient) -> None:
  response = await client.get("/analytics/summary")
  assert response.status_code == 200
  data = response.json()
  assert "total_documents" in data
  assert "total_funding" in data


@pytest.mark.asyncio
async def test_analytics_by_state(client: AsyncClient) -> None:
  response = await client.get("/analytics/by-state")
  assert response.status_code == 200
  data = response.json()
  assert isinstance(data, list)


@pytest.mark.asyncio
async def test_analytics_by_year(client: AsyncClient) -> None:
  response = await client.get("/analytics/by-year")
  assert response.status_code == 200
  data = response.json()
  assert isinstance(data, list)
