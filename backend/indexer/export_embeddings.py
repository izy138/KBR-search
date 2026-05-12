"""GPU encoding script — run this on the teammate's machine.

Reads a CSV, computes embeddings using the same model + text builder used by
the main indexer, and writes an NDJSON file where every line is one document
(all CSV fields + an "embedding" key holding the vector as a JSON array).

That NDJSON can then be copied to the main machine and bulk-indexed with
import_embeddings.py.

Usage (on the GPU machine, from the repo root):
    # Install deps once (into a venv or conda env):
    #   pip install sentence-transformers pandas tqdm torch
    #
    # Run (EMBEDDING_MODEL must match what the main indexer uses):
    EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2 \\
    python indexer/export_embeddings.py 2025_data.csv --out 2025_data_embedded.ndjson

Env vars honoured:
    EMBEDDING_MODEL          sentence-transformers model name (required to
                             match the main indexer — default: all-mpnet-base-v2)
    EMBEDDING_DEVICE         auto | cuda | cuda:N | mps | cpu (default: auto)
    EMBEDDING_SHOW_PROGRESS  set to "1" to show per-batch tqdm bar
    EMBEDDING_TERM_STATS_PATH  path to term_stats.json (default: term_stats.json)
    EMBEDDING_TERM_MAX_DF_RATIO  df_ratio cut-off for generic terms (default: 0.20)
    EMBEDDING_ENCODE_BATCH_SIZE  encode batch size — increase on GPU (default: 64)
    EMBEDDING_ABSTRACT_MAX_CHARS  max chars of ABSTRACT_TEXT per row (default: 12000; 0 = unlimited)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Allow running as  python indexer/export_embeddings.py  from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.embeddings import (  # noqa: E402
  build_text_for_record,
  get_embedding_device,
  get_model,
)
from load_data import iter_csv_chunks  # noqa: E402

CHUNK_SIZE = 2_000
DEFAULT_BATCH_SIZE = 64  # larger default: GPU can handle bigger batches


def _encode_chunk(
  records: list[dict],
  model: object,
  batch_size: int,
  show_progress: bool,
) -> list[list[float]]:
  import numpy as np  # type: ignore[import]

  texts = [build_text_for_record(r) for r in records]
  vectors = model.encode(  # type: ignore[union-attr]
    texts,
    batch_size=batch_size,
    show_progress_bar=show_progress,
    convert_to_numpy=True,
    normalize_embeddings=True,
  )
  return [v.tolist() for v in vectors]


def export(data_file: Path, out_file: Path, batch_size: int) -> None:
  show_progress = os.getenv("EMBEDDING_SHOW_PROGRESS") == "1"
  model = get_model()
  print(f"Encode device: {get_embedding_device()}", flush=True)

  total = 0
  t_start = time.perf_counter()

  with out_file.open("w", encoding="utf-8") as fh:
    for chunk_idx, chunk in enumerate(iter_csv_chunks(data_file, chunk_size=CHUNK_SIZE), 1):
      t0 = time.perf_counter()
      vectors = _encode_chunk(chunk, model, batch_size, show_progress)
      t1 = time.perf_counter()
      elapsed = t1 - t0
      rate = len(chunk) / max(elapsed, 1e-6)
      print(
        f"  chunk {chunk_idx}: embedded {len(chunk)} rows in {elapsed:.1f}s "
        f"({rate:.0f} docs/s); writing...",
        flush=True,
      )
      for record, vector in zip(chunk, vectors):
        record["embedding"] = vector
        fh.write(json.dumps(record, default=str) + "\n")
      total += len(chunk)

  elapsed_total = time.perf_counter() - t_start
  print(
    f"\nDone. Wrote {total:,} records to '{out_file}' "
    f"in {elapsed_total:.1f}s ({total / max(elapsed_total, 1e-6):.0f} docs/s overall).",
    flush=True,
  )


def main() -> None:
  parser = argparse.ArgumentParser(
    description="Encode a CSV with embeddings and write NDJSON for later bulk indexing."
  )
  parser.add_argument("data_file", help="Path to input CSV file.")
  parser.add_argument(
    "--out",
    default=None,
    help="Output NDJSON path (default: <data_file_stem>_embedded.ndjson).",
  )
  parser.add_argument(
    "--batch-size",
    type=int,
    default=int(os.getenv("EMBEDDING_ENCODE_BATCH_SIZE", DEFAULT_BATCH_SIZE)),
    help=f"Encode batch size (default: {DEFAULT_BATCH_SIZE}; increase on GPU).",
  )
  args = parser.parse_args()

  data_file = Path(args.data_file)
  if not data_file.exists():
    print(f"Error: file not found: {data_file}", file=sys.stderr)
    sys.exit(1)

  out_file = Path(args.out) if args.out else data_file.with_name(
    data_file.stem + "_embedded.ndjson"
  )

  print(f"Model : {os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-mpnet-base-v2')}")
  print(f"Input : {data_file}")
  print(f"Output: {out_file}")
  print(f"Batch : {args.batch_size}")
  print()

  export(data_file, out_file, args.batch_size)


if __name__ == "__main__":
  main()
