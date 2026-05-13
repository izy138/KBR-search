"""Drop and rebuild the project_data index from scratch."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure /app is on sys.path so `from api...` works when invoked as
# `python indexer/reindex.py` (Python only auto-adds the script's own dir).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.opensearch_client import get_client, get_index_name  # noqa: E402
from index_data import _build_arg_parser, bulk_load, create_index  # noqa: E402
from load_data import iter_csv_chunks  # noqa: E402


def reindex() -> None:
  args = _build_arg_parser("Wipe and rebuild the OpenSearch index.").parse_args()
  index_name = get_index_name()

  client = get_client(http_compress=True)
  if client.indices.exists(index=index_name):
    client.indices.delete(index=index_name)
    print(f"Deleted index '{index_name}'.")

  create_index(client, index_name, with_embeddings=args.with_embeddings)

  embed_note = " with embeddings" if args.with_embeddings else ""
  print(f"Reindexing '{args.data_file}' into '{index_name}'{embed_note}...", flush=True)
  successes, failures = bulk_load(
    client,
    index_name,
    iter_csv_chunks(args.data_file),
    with_embeddings=args.with_embeddings,
  )
  print(
    f"Done. Reindexed {successes:,} records ({failures:,} failures) into '{index_name}'."
  )


if __name__ == "__main__":
  reindex()
