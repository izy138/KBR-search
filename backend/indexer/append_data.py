"""Append (or upsert) a new data file into the existing project_data index.

Documents are written with a deterministic _id derived from APPLICATION_ID,
so overlapping rows update the existing document instead of creating
duplicates. Use this when you receive a new yearly export or an incremental
delta and want to fold it into the current index without a full rebuild.

Usage (inside the backend container):

  docker compose exec backend python indexer/append_data.py /app/2024_data.csv
  docker compose exec backend python indexer/append_data.py /app/2024_data.csv --with-embeddings
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure /app is on sys.path so `from api...` works when invoked as
# `python indexer/append_data.py` (Python only auto-adds the script's own dir).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.opensearch_client import get_client, get_index_name  # noqa: E402
from index_data import _build_arg_parser, bulk_load, create_index  # noqa: E402
from load_data import iter_csv_chunks  # noqa: E402


def append() -> None:
  parser = _build_arg_parser(
    "Append (upsert by APPLICATION_ID) a CSV into the existing OpenSearch index."
  )
  args = parser.parse_args()

  if not args.data_file:
    print(
      "Usage: python indexer/append_data.py <data_file.csv> [--with-embeddings]",
      file=sys.stderr,
    )
    sys.exit(1)

  index_name = get_index_name()
  client = get_client(http_compress=True)
  create_index(client, index_name, with_embeddings=args.with_embeddings)

  embed_note = " with embeddings" if args.with_embeddings else ""
  print(
    f"Appending '{args.data_file}' into '{index_name}'{embed_note} "
    "(upsert by APPLICATION_ID)...",
    flush=True,
  )
  successes, failures = bulk_load(
    client,
    index_name,
    iter_csv_chunks(args.data_file),
    with_embeddings=args.with_embeddings,
  )
  print(
    f"Done. Upserted {successes:,} records ({failures:,} failures) into '{index_name}'."
  )


if __name__ == "__main__":
  append()
