"""Indexes prepared records into OpenSearch."""

from __future__ import annotations

import os
import sys
from collections.abc import Iterable
from typing import Any

import pandas as pd
from opensearchpy.helpers import bulk

from api.opensearch_client import get_client, get_index_name
from load_data import iter_csv_chunks


def create_index(index_name: str) -> None:
    """Create index when missing."""
    client = get_client(http_compress=True)
    if client.indices.exists(index=index_name):
        return
    client.indices.create(index=index_name)


def index_records(index_name: str, records: Iterable[dict[str, Any]]) -> int:
    """Bulk index records."""
    client = get_client(http_compress=True)

    def sanitize_value(value: Any) -> Any:
        # OpenSearch cannot parse NaN/NaT tokens; convert them to JSON null.
        if pd.isna(value):
            return None
        return value

    def sanitize_record(record: dict[str, Any]) -> dict[str, Any]:
        return {key: sanitize_value(value) for key, value in record.items()}

    def actions() -> Iterable[dict[str, Any]]:
        for record in records:
            yield {"_index": index_name, "_source": sanitize_record(record)}

    success_count, _ = bulk(client, actions())
    return success_count


if __name__ == "__main__":
    index_name = get_index_name()
    data_file = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATA_FILE", "merged_project_data.csv")
    create_index(index_name)
    indexed_total = 0
    for chunk in iter_csv_chunks(data_file):
        indexed_total += index_records(index_name, chunk)
    print(f"Indexed {indexed_total} records into '{index_name}' from {data_file}.")
