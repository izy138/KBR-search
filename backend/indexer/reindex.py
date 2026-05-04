"""Drop and rebuild the project_data index from scratch."""
from __future__ import annotations

import os
import sys

from index_data import create_index, get_client, index_records
from load_data import load_csv


def reindex() -> None:
  index_name = os.getenv("OPENSEARCH_INDEX", "project_data")
  data_file = (
    sys.argv[1]
    if len(sys.argv) > 1
    else os.getenv("DATA_FILE", "2025_ProjectData.csv")
  )

  client = get_client()
  if client.indices.exists(index=index_name):
    client.indices.delete(index=index_name)
    print(f"Deleted index '{index_name}'.")

  create_index(index_name)
  records = load_csv(data_file)
  index_records(index_name, records)
  print(f"Reindexed {len(records)} records into '{index_name}' from {data_file}.")


if __name__ == "__main__":
  reindex()
