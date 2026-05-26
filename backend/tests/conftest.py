"""Shared test fixtures for backend integration tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app


@pytest.fixture
async def client() -> AsyncClient:
  transport = ASGITransport(app=app)
  async with AsyncClient(transport=transport, base_url="http://test") as ac:
    yield ac
