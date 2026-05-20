"""Load full-project rows from OGdata CSVs for search CSV export."""

from __future__ import annotations

import csv
import io
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pandas as pd

OGDATA_DIR = Path(__file__).resolve().parent.parent / "indexer" / "OGdata"
FY_FILE_PATTERN = "{year}_PROJECT.csv"
MAX_EXPORT_ROWS = 10_000
OG_SCAN_CHUNK_SIZE = 20_000
OG_EXPORT_MAX_WORKERS = 4


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


def _records_to_og_map(records: list[dict[str, object]]) -> dict[tuple[int, int | None], dict[str, object]]:
  found: dict[tuple[int, int | None], dict[str, object]] = {}
  for record in records:
    app_id = normalize_application_id(record.get("APPLICATION_ID"))
    if app_id is None:
      continue
    fy = normalize_fy(record.get("FY")) if "FY" in record else None
    key = (app_id, fy)
    if key not in found:
      found[key] = _row_to_dict(pd.Series(record))
  return found


def _scan_file_for_ids_pandas(
  path: Path,
  application_ids: set[int],
) -> dict[tuple[int, int | None], dict[str, object]]:
  if not application_ids or not path.is_file():
    return {}
  remaining = set(application_ids)
  records: list[dict[str, object]] = []
  for chunk in pd.read_csv(path, chunksize=OG_SCAN_CHUNK_SIZE, low_memory=False):
    if "APPLICATION_ID" not in chunk.columns:
      return {}
    chunk_ids = pd.to_numeric(chunk["APPLICATION_ID"], errors="coerce")
    mask = chunk_ids.isin(remaining)
    if not mask.any():
      continue
    matched = chunk.loc[mask]
    batch = matched.to_dict(orient="records")
    records.extend(batch)
    for record in batch:
      app_id = normalize_application_id(record.get("APPLICATION_ID"))
      if app_id is not None:
        remaining.discard(app_id)
    if not remaining:
      break
  return _records_to_og_map(records)


def _load_ids_from_csv_duckdb(
  path: Path,
  application_ids: set[int],
) -> dict[tuple[int, int | None], dict[str, object]]:
  import duckdb

  if not application_ids or not path.is_file():
    return {}

  conn = duckdb.connect()
  conn.register("wanted_ids", pd.DataFrame({"APPLICATION_ID": list(application_ids)}))
  try:
    frame = conn.execute(
      """
      SELECT og.*
      FROM read_csv(?, auto_detect=true, ignore_errors=true) AS og
      INNER JOIN wanted_ids AS w
        ON TRY_CAST(og.APPLICATION_ID AS BIGINT) = w.APPLICATION_ID
      """,
      [str(path)],
    ).fetchdf()
  finally:
    conn.close()

  return _records_to_og_map(frame.to_dict(orient="records"))


def _use_duckdb_for_export() -> bool:
  if os.getenv("OG_EXPORT_USE_DUCKDB", "true").strip().lower() in {"0", "false", "no"}:
    return False
  try:
    import duckdb  # noqa: F401
  except ImportError:
    return False
  return True


def _load_ids_from_csv(
  path: Path,
  application_ids: set[int],
) -> dict[tuple[int, int | None], dict[str, object]]:
  if _use_duckdb_for_export():
    try:
      return _load_ids_from_csv_duckdb(path, application_ids)
    except Exception:
      pass
  return _scan_file_for_ids_pandas(path, application_ids)


def _merge_found(
  found: dict[tuple[int, int | None], dict[str, object]],
  batch: dict[tuple[int, int | None], dict[str, object]],
) -> None:
  for key, row in batch.items():
    if key not in found:
      found[key] = row


def _ids_still_missing(
  ids: set[int],
  found: dict[tuple[int, int | None], dict[str, object]],
) -> set[int]:
  return {app_id for app_id in ids if not any(key[0] == app_id for key in found)}


def _scan_paths_parallel(
  paths: list[Path],
  application_ids: set[int],
  found: dict[tuple[int, int | None], dict[str, object]],
) -> None:
  if not paths or not application_ids:
    return
  workers = min(OG_EXPORT_MAX_WORKERS, len(paths))
  with ThreadPoolExecutor(max_workers=workers) as pool:
    futures = {
      pool.submit(_load_ids_from_csv, path, application_ids): path
      for path in paths
    }
    for future in as_completed(futures):
      _merge_found(found, future.result())


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
  all_files = list_og_files()

  for fy, app_ids in wanted_by_fy.items():
    remaining = set(app_ids)
    if fy is not None:
      path = og_file_for_fy(fy)
      if path.is_file():
        _merge_found(found, _load_ids_from_csv(path, remaining))
      remaining = _ids_still_missing(remaining, found)

    if remaining:
      other_paths = [p for p in all_files if fy is None or p != og_file_for_fy(fy)]
      _scan_paths_parallel(other_paths, remaining, found)

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
