"""Utilities for loading tabular data from Excel files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def load_excel(file_path: str | Path, sheet_name: str | int = 0) -> list[dict[str, Any]]:
    """Load an Excel sheet and return rows as dictionaries."""
    path = Path(file_path)
    dataframe = pd.read_excel(path, sheet_name=sheet_name)
    return dataframe.to_dict(orient="records")


if __name__ == "__main__":
    sample_path = Path("data/sample.xlsx")
    if not sample_path.exists():
        print(f"Excel file not found: {sample_path}")
    else:
        rows = load_excel(sample_path)
        print(f"Loaded {len(rows)} rows from {sample_path}")
