"""Sentence-embedding helpers shared by the indexer and the search API.

The model is loaded lazily on first use so the FastAPI process doesn't pay the
~2-3s import cost at startup, and the same singleton is reused for the lifetime
of the process. Indexing and querying must use the same model — vectors from
different models live in different geometric spaces and cannot be compared.

We also lazy-load a corpus-derived "generic terms" list (produced by
indexer/term_stats.py). When present, terms whose document-frequency ratio
exceeds EMBEDDING_TERM_MAX_DF_RATIO are stripped from PROJECT_TERMS before the
text is encoded, so the resulting vectors aren't dominated by words like
"research" or "data" that carry no discriminative signal.

ABSTRACT_TEXT is appended after title and terms when present. Very long
abstracts are truncated by default (EMBEDDING_ABSTRACT_MAX_CHARS); set to 0 for
no truncation.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

EMBEDDING_FIELD = "embedding"
DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

DEFAULT_TERM_STATS_PATH = "term_stats.json"
DEFAULT_TERM_MAX_DF_RATIO = 0.20
TERM_FIELD = "PROJECT_TERMS"
TERM_SEPARATOR = ";"
ABSTRACT_FIELD = "ABSTRACT_TEXT"

_TEXT_FIELDS = ("PROJECT_TITLE", TERM_FIELD, ABSTRACT_FIELD)

_model_lock = threading.Lock()
_cached_model: Any = None
_cached_dimension: int | None = None

_generic_lock = threading.Lock()
_cached_generic_terms: frozenset[str] | None = None


def get_model_name() -> str:
  return os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL_NAME)


def _configure_torch_threads() -> None:
  """Cap PyTorch CPU threads to avoid over-subscription on Docker Desktop.

  PyTorch defaults to one intra-op thread per core; combined with
  parallel_bulk's worker threads and tokenizer parallelism this thrashes
  the cache inside Docker's VM. A small, fixed thread count is much
  faster in practice for sentence-transformer encoding on CPU.
  """
  try:
    import torch

    raw = os.getenv("TORCH_NUM_THREADS")
    n_threads = int(raw) if raw else 4
    torch.set_num_threads(max(1, n_threads))
    print(f"Pinned PyTorch to {torch.get_num_threads()} CPU thread(s).", flush=True)
  except Exception as exc:  # pragma: no cover - defensive
    print(f"Could not configure torch threads: {exc}", flush=True)


def get_model() -> Any:
  """Load and memoize the SentenceTransformer model on first call."""
  global _cached_model, _cached_dimension
  if _cached_model is not None:
    return _cached_model
  with _model_lock:
    if _cached_model is not None:
      return _cached_model
    _configure_torch_threads()
    from sentence_transformers import SentenceTransformer

    model_name = get_model_name()
    print(f"Loading embedding model '{model_name}'...", flush=True)
    model = SentenceTransformer(model_name)
    try:
      _cached_dimension = int(model.get_embedding_dimension())
    except AttributeError:  # pragma: no cover - older sentence-transformers
      _cached_dimension = int(model.get_sentence_embedding_dimension())
    _cached_model = model
    print(f"Embedding model ready (dimension={_cached_dimension}).", flush=True)
    return _cached_model


def get_dimension() -> int:
  """Return the embedding dimension, loading the model if necessary."""
  if _cached_dimension is not None:
    return _cached_dimension
  get_model()
  assert _cached_dimension is not None
  return _cached_dimension


def _term_stats_path() -> Path:
  return Path(os.getenv("EMBEDDING_TERM_STATS_PATH", DEFAULT_TERM_STATS_PATH))


def _term_max_df_ratio() -> float:
  raw = os.getenv("EMBEDDING_TERM_MAX_DF_RATIO")
  if raw is None:
    return DEFAULT_TERM_MAX_DF_RATIO
  try:
    return float(raw)
  except ValueError:
    return DEFAULT_TERM_MAX_DF_RATIO


def _abstract_max_chars() -> int | None:
  """Max characters of ABSTRACT_TEXT to embed; None means no limit."""
  raw = os.getenv("EMBEDDING_ABSTRACT_MAX_CHARS")
  if raw is None:
    return 12_000
  stripped = raw.strip().lower()
  if stripped in ("0", "none", ""):
    return None
  try:
    return max(1, int(raw))
  except ValueError:
    return 12_000


def get_generic_terms() -> frozenset[str]:
  """Load (once) the set of PROJECT_TERMS to strip before encoding.

  Returns an empty set if no term_stats.json exists, which makes this feature
  cleanly opt-in: the system behaves exactly as before until you generate the
  stats file.
  """
  global _cached_generic_terms
  if _cached_generic_terms is not None:
    return _cached_generic_terms
  with _generic_lock:
    if _cached_generic_terms is not None:
      return _cached_generic_terms

    path = _term_stats_path()
    if not path.exists():
      _cached_generic_terms = frozenset()
      return _cached_generic_terms

    threshold = _term_max_df_ratio()
    try:
      stats = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
      print(f"Warning: could not read term stats from {path}: {exc}", flush=True)
      _cached_generic_terms = frozenset()
      return _cached_generic_terms

    generic = frozenset(
      str(entry["term"]).lower()
      for entry in stats.get("terms", [])
      if float(entry.get("df_ratio", 0.0)) >= threshold
    )
    print(
      f"Loaded {len(generic):,} generic terms from {path} "
      f"(df_ratio >= {threshold:.2f}).",
      flush=True,
    )
    _cached_generic_terms = generic
    return _cached_generic_terms


def _filter_terms_field(value: str, generic_terms: frozenset[str]) -> str:
  """Drop terms in the generic set; preserve the remaining ones in order."""
  kept: list[str] = []
  for raw in value.split(TERM_SEPARATOR):
    term = raw.strip()
    if not term:
      continue
    if term.lower() in generic_terms:
      continue
    kept.append(term)
  return "; ".join(kept)


def build_text_for_record(record: dict[str, Any]) -> str:
  """Concatenate the descriptive text fields used to embed a project row.

  We deliberately ignore administrative fields (IDs, dollar amounts, dates) —
  they would only add noise to the semantic vector. PROJECT_TERMS additionally
  has corpus-common terms stripped (see get_generic_terms). ABSTRACT_TEXT is
  included when present (truncated per _abstract_max_chars).
  """
  generic_terms = get_generic_terms()
  abstract_cap = _abstract_max_chars()
  parts: list[str] = []
  for field in _TEXT_FIELDS:
    value = record.get(field)
    if value is None:
      continue
    text = str(value).strip()
    if not text:
      continue
    if field == TERM_FIELD and generic_terms:
      text = _filter_terms_field(text, generic_terms)
      if not text:
        continue
    if field == ABSTRACT_FIELD and abstract_cap is not None and len(text) > abstract_cap:
      text = text[:abstract_cap] + "..."
    parts.append(text)
  return "\n".join(parts)


def embed_texts(texts: list[str], *, batch_size: int = 32) -> list[list[float]]:
  """Encode a list of strings to embedding vectors.

  Returns plain Python lists so the result can be JSON-serialized straight
  into OpenSearch bulk actions. ``EMBEDDING_SHOW_PROGRESS=1`` enables the
  per-batch progress bar for diagnostics during long ingests.
  """
  if not texts:
    return []
  model = get_model()
  show_progress = os.getenv("EMBEDDING_SHOW_PROGRESS") == "1"
  vectors = model.encode(
    texts,
    batch_size=batch_size,
    show_progress_bar=show_progress,
    convert_to_numpy=True,
    normalize_embeddings=True,
  )
  return [vector.tolist() for vector in vectors]


def embed_query(text: str) -> list[float]:
  """Convenience wrapper for the single-query path used by the search API."""
  vectors = embed_texts([text])
  return vectors[0]
