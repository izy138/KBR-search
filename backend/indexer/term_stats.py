"""Compute corpus-wide document frequencies for the PROJECT_TERMS field.

PROJECT_TERMS is a semicolon-separated MeSH-style keyword list. A handful of
terms ("research", "data", "human"...) appear in a huge fraction of projects;
those terms add noise to dense embeddings without disambiguating anything.

This script writes a JSON file the API and indexer can load to filter such
generic terms out before encoding. Run it once per corpus refresh.

Usage:

  docker compose exec backend python indexer/term_stats.py /app/2025_data.csv
  docker compose exec backend python indexer/term_stats.py \\
    /app/2020_data.csv /app/2021_data.csv /app/2022_data.csv \\
    /app/2023_data.csv /app/2024_data.csv /app/2025_data.csv
  docker compose exec backend python indexer/term_stats.py --top 50 --output term_stats.json

Output schema (term_stats.json):

  {
    "doc_count": 76219,
    "field": "PROJECT_TERMS",
    "separator": ";",
    "terms": [
      {"term": "research", "df": 64250, "df_ratio": 0.843, "idf": 0.171},
      ...
    ]
  }

`terms` is sorted by descending df, so the highest-frequency (most generic)
terms are first.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter
from pathlib import Path
from typing import Iterable, Iterator

from load_data import iter_csv_chunks


TERM_FIELD = "PROJECT_TERMS"
TERM_SEPARATOR = ";"


def normalize_term(term: str) -> str:
  """Lowercase + strip — the canonical form used for matching."""
  return term.strip().lower()


def iter_terms(value: str) -> Iterator[str]:
  """Yield normalized terms from a single PROJECT_TERMS cell."""
  if not value:
    return
  for raw in value.split(TERM_SEPARATOR):
    norm = normalize_term(raw)
    if norm:
      yield norm


def _accumulate_file(
  data_file: str | Path,
  doc_count: int,
  doc_freq: Counter[str],
) -> int:
  """Add one CSV's rows into doc_freq; return updated doc_count."""
  for chunk in iter_csv_chunks(data_file):
    for record in chunk:
      doc_count += 1
      value = record.get(TERM_FIELD)
      if value is None:
        continue
      # Per-doc set so a term counted twice in one row only adds 1 to df.
      terms_in_doc = set(iter_terms(str(value)))
      for term in terms_in_doc:
        doc_freq[term] += 1
  return doc_count


def compute_stats(data_files: str | Path | Iterable[str | Path]) -> dict[str, object]:
  """Walk one or more CSVs in chunks and tally per-document term occurrences."""
  paths: list[Path]
  if isinstance(data_files, (str, Path)):
    paths = [Path(data_files)]
  else:
    paths = [Path(p) for p in data_files]

  doc_count = 0
  doc_freq: Counter[str] = Counter()
  for path in paths:
    if not path.exists():
      raise FileNotFoundError(f"Data file not found: {path.resolve()}")
    print(f"Scanning '{path}'...", flush=True)
    doc_count = _accumulate_file(path, doc_count, doc_freq)

  entries: list[dict[str, object]] = []
  for term, df in doc_freq.most_common():
    df_ratio = df / doc_count if doc_count else 0.0
    # Smoothed IDF avoids div-by-zero edges and matches the standard formula.
    idf = math.log(doc_count / df) if df > 0 else 0.0
    entries.append(
      {
        "term": term,
        "df": df,
        "df_ratio": round(df_ratio, 6),
        "idf": round(idf, 6),
      }
    )

  return {
    "doc_count": doc_count,
    "field": TERM_FIELD,
    "separator": TERM_SEPARATOR,
    "terms": entries,
  }


def _print_top(stats: dict[str, object], top: int) -> None:
  doc_count = int(stats["doc_count"])
  terms = stats["terms"]
  assert isinstance(terms, list)
  print(f"\nTop {top} most frequent {TERM_FIELD} (of {doc_count:,} docs):")
  print(f"  {'pct':>6}  {'count':>8}  term")
  for entry in terms[:top]:
    pct = float(entry["df_ratio"]) * 100  # type: ignore[arg-type]
    df = int(entry["df"])  # type: ignore[arg-type]
    print(f"  {pct:5.1f}%  {df:>8,}  {entry['term']}")


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
  parser.add_argument(
    "data_files",
    nargs="*",
    metavar="CSV",
    help=(
      "One or more CSV paths (concatenated as one corpus). "
      "If omitted, uses $DATA_FILE or 2025_data.csv."
    ),
  )
  parser.add_argument(
    "--output",
    default="term_stats.json",
    help="Where to write the term-statistics JSON file (default: term_stats.json).",
  )
  parser.add_argument(
    "--top",
    type=int,
    default=100,
    help="Number of most-frequent terms to print to stdout (default: 100).",
  )
  args = parser.parse_args()

  paths: list[str | Path] = (
    list(args.data_files)
    if args.data_files
    else [os.getenv("DATA_FILE", "2025_data.csv")]
  )
  stats = compute_stats(paths)

  output_path = Path(args.output)
  output_path.write_text(json.dumps(stats, indent=2))
  unique_count = len(stats["terms"])  # type: ignore[arg-type]
  print(
    f"Wrote {unique_count:,} unique terms across "
    f"{int(stats['doc_count']):,} documents to {output_path}."
  )

  _print_top(stats, args.top)


if __name__ == "__main__":
  main()
