"""Indexes prepared records into OpenSearch.

The bulk pipeline:

  CSV file
    -> iter_csv_chunks (2,000-row pandas chunks, NaN sanitized)
      -> (optional) _attach_embeddings (batch-encode descriptive text per chunk)
        -> _actions (deterministic _id from APPLICATION_ID for idempotency)
          -> parallel_bulk (multi-threaded HTTP requests, gzipped payloads)

A single OpenSearch client is reused for the entire run, and during bulk
loads the index's refresh_interval and number_of_replicas are temporarily
relaxed so OpenSearch can absorb writes faster, then restored.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

# Ensure /app is on sys.path so `from api...` works when invoked as
# `python indexer/index_data.py` (Python only auto-adds the script's own dir).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from opensearchpy import OpenSearch  # noqa: E402
from opensearchpy.helpers import parallel_bulk  # noqa: E402

from api.embeddings import (  # noqa: E402
  EMBEDDING_FIELD,
  build_text_for_record,
  embed_texts,
  get_dimension,
)
from api.opensearch_client import get_client, get_index_name  # noqa: E402
from load_data import iter_csv_chunks  # noqa: E402


BULK_CHUNK_SIZE = 1_000
BULK_THREAD_COUNT = 8
BULK_QUEUE_SIZE = 8
ID_FIELD = "APPLICATION_ID"


def _knn_mapping(dimension: int) -> dict[str, Any]:
  return {
    "type": "knn_vector",
    "dimension": dimension,
    "method": {
      "name": "hnsw",
      "engine": "lucene",
      "space_type": "cosinesimil",
    },
  }


def create_index(
  client: OpenSearch,
  index_name: str,
  *,
  with_embeddings: bool = False,
) -> None:
  """Create the index when missing.

  When ``with_embeddings`` is true, the index is created with k-NN enabled and
  an explicit ``embedding`` field mapping. If the index already exists and
  ``with_embeddings`` is set, we verify the existing mapping has the field and
  raise a clear error otherwise — toggling k-NN on requires a full reindex.
  """
  exists = client.indices.exists(index=index_name)

  if not exists:
    body: dict[str, Any] = {}
    if with_embeddings:
      body["settings"] = {"index": {"knn": True}}
      body["mappings"] = {
        "properties": {EMBEDDING_FIELD: _knn_mapping(get_dimension())}
      }
    client.indices.create(index=index_name, body=body or None)
    return

  if with_embeddings:
    mapping = (
      client.indices.get_mapping(index=index_name)
      .get(index_name, {})
      .get("mappings", {})
      .get("properties", {})
    )
    if EMBEDDING_FIELD not in mapping:
      raise RuntimeError(
        f"Index '{index_name}' exists without an '{EMBEDDING_FIELD}' field. "
        "Run reindex.py --with-embeddings to rebuild with k-NN enabled."
      )


def _actions(
  index_name: str,
  records: Iterable[dict[str, Any]],
) -> Iterator[dict[str, Any]]:
  # Deterministic _id makes reruns idempotent: rows with the same
  # APPLICATION_ID overwrite the existing document instead of duplicating.
  for record in records:
    doc_id = record.get(ID_FIELD)
    action: dict[str, Any] = {"_index": index_name, "_source": record}
    if doc_id is not None:
      action["_id"] = str(doc_id)
    yield action


def _attach_embeddings(
  chunks: Iterable[list[dict[str, Any]]],
) -> Iterator[list[dict[str, Any]]]:
  """Compute embeddings for each chunk in one batched encode call.

  Embedding the whole chunk in a single call is much faster than embedding
  per-row because sentence-transformers amortizes model-call overhead across
  the batch (and uses SIMD/GPU efficiently).

  Per-chunk timing is logged so we can see exactly where wall-time is being
  spent during a long ingest.
  """
  import time

  chunk_index = 0
  for chunk in chunks:
    chunk_index += 1
    print(f"  chunk {chunk_index}: received {len(chunk)} rows, building texts...", flush=True)
    t0 = time.perf_counter()
    texts = [build_text_for_record(record) for record in chunk]
    t1 = time.perf_counter()
    # Surface input size — extremely long texts blow up tokenization time.
    max_chars = max((len(t) for t in texts), default=0)
    avg_chars = sum(len(t) for t in texts) / max(len(texts), 1)
    print(
      f"  chunk {chunk_index}: built {len(texts)} texts in {t1 - t0:.2f}s "
      f"(avg {avg_chars:.0f} chars, max {max_chars}); embedding...",
      flush=True,
    )
    vectors = embed_texts(texts)
    t2 = time.perf_counter()
    for record, vector in zip(chunk, vectors):
      record[EMBEDDING_FIELD] = vector
    print(
      f"  chunk {chunk_index}: embedded in {t2 - t1:.2f}s "
      f"({len(texts) / max(t2 - t1, 1e-6):.0f} docs/s); shipping to OpenSearch...",
      flush=True,
    )
    yield chunk


@contextmanager
def _bulk_load_settings(client: OpenSearch, index_name: str) -> Iterator[None]:
  """Relax refresh/replicas for the duration of a bulk load, then restore them."""
  current = (
    client.indices.get_settings(index=index_name)
    .get(index_name, {})
    .get("settings", {})
    .get("index", {})
  )
  original_refresh = current.get("refresh_interval", "1s")
  original_replicas = current.get("number_of_replicas", "1")

  client.indices.put_settings(
    index=index_name,
    body={"index": {"refresh_interval": "-1", "number_of_replicas": 0}},
  )
  try:
    yield
  finally:
    client.indices.put_settings(
      index=index_name,
      body={
        "index": {
          "refresh_interval": original_refresh,
          "number_of_replicas": original_replicas,
        }
      },
    )
    client.indices.refresh(index=index_name)


def bulk_load(
  client: OpenSearch,
  index_name: str,
  chunks: Iterable[list[dict[str, Any]]],
  *,
  optimize_for_bulk: bool = True,
  with_embeddings: bool = False,
) -> tuple[int, int]:
  """Stream chunks into OpenSearch via parallel_bulk.

  Returns (success_count, failure_count). Failures are logged (first few in full)
  but do not abort the run, so a single bad row never kills a large ingest.
  """
  effective_chunks = _attach_embeddings(chunks) if with_embeddings else chunks

  def all_actions() -> Iterator[dict[str, Any]]:
    for chunk in effective_chunks:
      yield from _actions(index_name, chunk)

  successes = 0
  failures = 0

  def _run() -> None:
    nonlocal successes, failures
    for ok, item in parallel_bulk(
      client,
      all_actions(),
      thread_count=BULK_THREAD_COUNT,
      chunk_size=BULK_CHUNK_SIZE,
      queue_size=BULK_QUEUE_SIZE,
      raise_on_error=False,
      raise_on_exception=False,
    ):
      if ok:
        successes += 1
        if successes % 1_000 == 0:
          print(f"  ...indexed {successes:,} records", flush=True)
      else:
        failures += 1
        if failures <= 5:
          print(f"  bulk error: {item}", flush=True)

  if optimize_for_bulk:
    with _bulk_load_settings(client, index_name):
      _run()
  else:
    _run()

  return successes, failures


def _build_arg_parser(description: str) -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(description=description)
  parser.add_argument(
    "data_file",
    nargs="?",
    default=os.getenv("DATA_FILE", "2025_data.csv"),
    help="Path to the CSV file to index (defaults to $DATA_FILE).",
  )
  parser.add_argument(
    "--with-embeddings",
    action="store_true",
    help="Compute sentence embeddings and attach them to each document.",
  )
  return parser


if __name__ == "__main__":
  args = _build_arg_parser("Bulk-index a CSV into OpenSearch.").parse_args()

  index_name = get_index_name()
  client = get_client(http_compress=True)
  create_index(client, index_name, with_embeddings=args.with_embeddings)

  embed_note = " with embeddings" if args.with_embeddings else ""
  print(f"Indexing '{args.data_file}' into '{index_name}'{embed_note}...", flush=True)
  successes, failures = bulk_load(
    client,
    index_name,
    iter_csv_chunks(args.data_file),
    with_embeddings=args.with_embeddings,
  )
  print(
    f"Done. Indexed {successes:,} records ({failures:,} failures) into '{index_name}'."
  )
