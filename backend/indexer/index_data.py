"""Indexes prepared records into OpenSearch."""

from __future__ import annotations

import os
import sys
from typing import Any

import pandas as pd
from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk

from load_data import load_csv


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


def create_index(index_name: str) -> None:
    """Create index when missing."""
    client = get_client()
    if client.indices.exists(index=index_name):
        return
    client.indices.create(index=index_name)


def index_records(index_name: str, records: list[dict[str, Any]]) -> None:
    """Bulk index records."""
    client = get_client()

    def sanitize_value(value: Any) -> Any:
        # OpenSearch cannot parse NaN/NaT tokens; convert them to JSON null.
        if pd.isna(value):
            return None
        return value

    def sanitize_record(record: dict[str, Any]) -> dict[str, Any]:
        return {key: sanitize_value(value) for key, value in record.items()}

    def actions() -> list[dict[str, Any]]:
        for record in records:
            yield {"_index": index_name, "_source": sanitize_record(record)}

    bulk(client, actions())


if __name__ == "__main__":
    index_name = os.getenv("OPENSEARCH_INDEX", "project_data")
    data_file = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATA_FILE", "merged_project_data.csv")
    records = load_csv(data_file)
    create_index(index_name)
    index_records(index_name, records)
    print(f"Indexed {len(records)} records into '{index_name}' from {data_file}.")
