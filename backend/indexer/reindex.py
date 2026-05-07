"""Drop and rebuild the project_data index from scratch."""
from __future__ import annotations

import os
import sys

from api.opensearch_client import get_client, get_index_name
from index_data import create_index, index_records
from load_data import iter_csv_chunks


def reindex() -> None:
  index_name = get_index_name()
  data_file = (
    sys.argv[1]
    if len(sys.argv) > 1
    else os.getenv("DATA_FILE", "merged_project_data.csv")
  )

  client = get_client()
  if client.indices.exists(index=index_name):
    client.indices.delete(index=index_name)
    print(f"Deleted index '{index_name}'.")

  create_index(index_name)
  indexed_total = 0
  for chunk in iter_csv_chunks(data_file):
    indexed_total += index_records(index_name, chunk)
  print(f"Reindexed {indexed_total} records into '{index_name}' from {data_file}.")


if __name__ == "__main__":
  reindex()
