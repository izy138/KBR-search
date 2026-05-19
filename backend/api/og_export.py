"""Load full-project rows from OGdata CSVs for search export."""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

OGDATA_DIR = Path(__file__).resolve().parent.parent / "indexer" / "OGdata"
FY_FILE_PATTERN = "{year}_PROJECT.csv"
MAX_EXPORT_ROWS = 10_000


def og_file_for_fy(fy: int) -> Path:
  return OGDATA_DIR / FY_FILE_PATTERN.format(year=fy)


def list_og_files() -> list[Path]:
  if not OGDATA_DIR.is_dir():
    return []
  return sorted(OGDATA_DIR.glob("*_PROJECT.csv"))


def read_og_header(path: Path) -> list[str]:
  with path.open(encoding="utf-8", errors="replace", newline="") as handle:
    reader = csv.reader(handle)
    return next(reader, [])


def normalize_application_id(value: object) -> int | None:
  if value is None or (isinstance(value, float) and pd.isna(value)):
    return None
  try:
    parsed = int(float(str(value).strip()))
  except (TypeError, ValueError):
    return None
  return parsed if parsed > 0 else None


def normalize_fy(value: object) -> int | None:
  if value is None or (isinstance(value, float) and pd.isna(value)):
    return None
  try:
    parsed = int(float(str(value).strip()))
  except (TypeError, ValueError):
    return None
  return parsed if 1900 <= parsed <= 2100 else None


def _row_to_dict(row: pd.Series) -> dict[str, object]:
  out: dict[str, object] = {}
  for key, value in row.items():
    col = str(key)
    if pd.isna(value):
      out[col] = None
    elif isinstance(value, (int, float, str, bool)):
      out[col] = value
    else:
      out[col] = str(value)
  return out


def _scan_file_for_ids(
  path: Path,
  application_ids: set[int],
  found: dict[tuple[int, int | None], dict[str, object]],
) -> None:
  if not application_ids:
    return
  remaining = set(application_ids)
  for chunk in pd.read_csv(path, chunksize=5_000, low_memory=False):
    if "APPLICATION_ID" not in chunk.columns:
      return
    chunk_ids = pd.to_numeric(chunk["APPLICATION_ID"], errors="coerce")
    mask = chunk_ids.isin(remaining)
    if not mask.any():
      continue
    matched = chunk.loc[mask]
    for _, row in matched.iterrows():
      app_id = normalize_application_id(row.get("APPLICATION_ID"))
      if app_id is None:
        continue
      fy = normalize_fy(row.get("FY")) if "FY" in row.index else None
      key = (app_id, fy)
      if key in found:
        continue
      found[key] = _row_to_dict(row)
      remaining.discard(app_id)
    if not remaining:
      return


def load_og_rows(
  keys: list[tuple[int | None, int | None]],
) -> dict[tuple[int, int | None], dict[str, object]]:
  """Map (APPLICATION_ID, FY) to a full OG CSV row."""
  wanted_by_fy: dict[int | None, set[int]] = {}
  for app_id, fy in keys:
    if app_id is None:
      continue
    wanted_by_fy.setdefault(fy, set()).add(app_id)

  found: dict[tuple[int, int | None], dict[str, object]] = {}

  for fy, app_ids in wanted_by_fy.items():
    if fy is not None:
      path = og_file_for_fy(fy)
      if path.is_file():
        _scan_file_for_ids(path, app_ids, found)
      continue

    for path in list_og_files():
      still_need = app_ids - {key[0] for key in found if key[0] in app_ids}
      if not still_need:
        break
      _scan_file_for_ids(path, still_need, found)

  return found


def resolve_export_columns(sample_fy: int | None) -> list[str]:
  if sample_fy is not None:
    path = og_file_for_fy(sample_fy)
    if path.is_file():
      return read_og_header(path)
  files = list_og_files()
  if files:
    return read_og_header(files[0])
  return []


def _csv_cell(value: object) -> str:
  if value is None:
    return ""
  return str(value)


def build_export_csv(
  ordered_rows: list[dict[str, object]],
  fieldnames: list[str],
) -> str:
  buffer = io.StringIO()
  writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
  writer.writeheader()
  for row in ordered_rows:
    writer.writerow({name: _csv_cell(row.get(name)) for name in fieldnames})
  return buffer.getvalue()


def ordered_export_rows(
  hits: list[dict[str, object]],
  og_rows: dict[tuple[int, int | None], dict[str, object]],
) -> list[dict[str, object]]:
  ordered: list[dict[str, object]] = []
  for hit in hits:
    source = hit.get("_source", hit)
    if not isinstance(source, dict):
      continue
    app_id = normalize_application_id(source.get("APPLICATION_ID"))
    fy = normalize_fy(source.get("FY"))
    if app_id is None:
      ordered.append({k: v for k, v in source.items() if not str(k).startswith("_")})
      continue
    og_row = og_rows.get((app_id, fy))
    if og_row is None and fy is not None:
      og_row = og_rows.get((app_id, None))
    ordered.append(og_row if og_row is not None else source)
  return ordered
