"""Utilities for loading tabular data files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def load_excel(file_path: str | Path, sheet_name: str | int = 0) -> list[dict[str, Any]]:
    """Load an Excel sheet and return rows as dictionaries."""
    path = Path(file_path)
    dataframe = pd.read_excel(path, sheet_name=sheet_name)
    return dataframe.to_dict(orient="records")


def load_csv(file_path: str | Path) -> list[dict[str, Any]]:
    """Load CSV rows as dictionaries."""
    path = Path(file_path)
    dataframe = pd.read_csv(path)
    return dataframe.to_dict(orient="records")


if __name__ == "__main__":
    sample_path = Path("2025_ProjectData.csv")
    if not sample_path.exists():
        print(f"Data file not found: {sample_path}")
    else:
        rows = load_csv(sample_path)
        print(f"Loaded {len(rows)} rows from {sample_path}")
