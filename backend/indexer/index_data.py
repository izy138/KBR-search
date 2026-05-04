"""Indexes prepared records into OpenSearch."""

from __future__ import annotations

import os
from typing import Any

from opensearchpy import OpenSearch


def get_client() -> OpenSearch:
    """Create an OpenSearch client using environment variables."""
    host = os.getenv("OPENSEARCH_HOST", "localhost")
    port = int(os.getenv("OPENSEARCH_PORT", "9200"))
    return OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_compress=True,
        use_ssl=False,
        verify_certs=False,
    )


def index_records(index_name: str, records: list[dict[str, Any]]) -> None:
    """Index records one by one for simplicity."""
    client = get_client()
    for record in records:
        client.index(index=index_name, body=record)


if __name__ == "__main__":
    # Placeholder usage for local smoke-testing.
    demo_records = [{"title": "Example", "category": "demo"}]
    index_records("documents", demo_records)
    print("Indexed demo records to OpenSearch.")
