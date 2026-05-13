"""Utilities for loading tabular data files."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterator

import pandas as pd


def _sanitize_dataframe(dataframe: pd.DataFrame) -> pd.DataFrame:
  # OpenSearch cannot parse NaN/NaT tokens; convert them to JSON null in one
  # vectorized pass instead of per-cell pd.isna checks in the indexer.
  return dataframe.astype(object).where(pd.notna(dataframe), None)


def load_excel(file_path: str | Path, sheet_name: str | int = 0) -> list[dict[str, Any]]:
  """Load an Excel sheet and return rows as dictionaries."""
  path = Path(file_path)
  dataframe = pd.read_excel(path, sheet_name=sheet_name)
  return _sanitize_dataframe(dataframe).to_dict(orient="records")


def load_csv(file_path: str | Path) -> list[dict[str, Any]]:
  """Load CSV rows as dictionaries with NaN/NaT normalized to None."""
  path = Path(file_path)
  dataframe = pd.read_csv(path)
  return _sanitize_dataframe(dataframe).to_dict(orient="records")


def iter_csv_chunks(
  file_path: str | Path,
  *,
  chunk_size: int = 2_000,
) -> Iterator[list[dict[str, Any]]]:
  """Yield CSV rows in sanitized chunks without loading the full file into memory."""
  path = Path(file_path)
  for dataframe in pd.read_csv(path, chunksize=chunk_size):
    yield _sanitize_dataframe(dataframe).to_dict(orient="records")


if __name__ == "__main__":
  sample_path = Path("2025_data.csv")
  if not sample_path.exists():
    print(f"Data file not found: {sample_path}")
  else:
    rows = load_csv(sample_path)
    print(f"Loaded {len(rows)} rows from {sample_path}")
