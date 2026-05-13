"""Build ``project_term_theme_counts.json`` for the dashboard theme cloud.

Same logic as the *Auto-route all ;-split terms* cell in ``proj_data_analysis.ipynb``:
stream ``PROJECT_TERMS`` from ``indexer/data/*_data.csv``, embed terms + anchor
paragraphs, assign each term to the nearest anchor, aggregate masses, write JSON.

Run from repo root (Docker) or ``backend/``:

  docker compose exec backend python indexer/build_project_term_theme_counts.py

  cd backend && python indexer/build_project_term_theme_counts.py

Requires ``indexer/data/{year}_data.csv`` with a ``PROJECT_TERMS`` column (same
exports the notebook uses). Restart or reload the API after writing the file.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from api.embeddings import get_model, get_model_name  # noqa: E402

INDEXER = Path(__file__).resolve().parent
DATA_DIR = INDEXER / "data"
DEFAULT_OUT = INDEXER / "project_term_theme_counts.json"

SPLIT_ON = ";"
CHUNK_ROWS = 50_000
MIN_TERM_COUNT = 1
MAX_TERM_CHARS = 480
TERM_BATCH = 128
LOW_CONFIDENCE = 0.18

# Keep in sync with the anchor dict in ``proj_data_analysis.ipynb`` (embedding cell).
CATEGORY_ANCHORS: dict[str, str] = {
  "Health": (
    "Biomedical and clinical research: human disease, patients, hospitals, public health, "
    "epidemiology, nutrition, mental health, physiology, pharmacology, cancer, immunology, "
    "infectious disease, neuroscience, aging, exercise, biomarkers, clinical trials."
  ),
  "Engineering": (
    "Engineering and applied technology: mechanical, electrical, civil, materials, chemical, "
    "aerospace, manufacturing, robotics, sensors, control systems, design, optimization, "
    "fabrication, hardware, energy systems, nanotechnology, MEMS, infrastructure."
  ),
  "Computing_AI": (
    "Computer science, software, algorithms, machine learning, artificial intelligence, "
    "data science, databases, cybersecurity, visualization, high performance computing, "
    "natural language processing, computer vision, statistical modeling."
  ),
  "Life_sci_basic": (
    "Basic life sciences in cells and molecules: genetics, genomics, proteomics, biochemistry, "
    "cell biology, microbiology, developmental biology, molecular mechanisms, model organisms, "
    "structural biology, bioinformatics without clinical focus."
  ),
  "Social_Education": (
    "Social, behavioral, economic, and education research: psychology, sociology, policy, "
    "inequality, schools, learning sciences, workforce training, surveys, implementation science."
  ),
  "Environment_Earth": (
    "Environmental, climate, ecology, ocean, atmospheric, geology, hydrology, sustainability, "
    "agriculture-environment interface, natural resources, conservation."
  ),
}


def _collect_term_freq(data_dir: Path) -> Counter[str]:
  paths = sorted(p.resolve() for p in data_dir.glob("*_data.csv") if p.is_file())
  if not paths:
    raise FileNotFoundError(f"No *_data.csv under {data_dir.resolve()}")
  term_freq: Counter[str] = Counter()
  for path in paths:
    print(f"Reading {path.name} …")
    for chunk in pd.read_csv(
      path,
      usecols=["PROJECT_TERMS"],
      chunksize=CHUNK_ROWS,
      dtype=str,
      low_memory=False,
      on_bad_lines="skip",
    ):
      for raw in chunk["PROJECT_TERMS"].dropna():
        for piece in str(raw).split(SPLIT_ON):
          t = piece.strip()
          if t:
            term_freq[t] += 1
  return term_freq


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--data-dir",
    type=Path,
    default=DATA_DIR,
    help=f"Directory with *_data.csv (default: {DATA_DIR})",
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=DEFAULT_OUT,
    help=f"Output JSON path (default: {DEFAULT_OUT})",
  )
  parser.add_argument(
    "--min-term-count",
    type=int,
    default=MIN_TERM_COUNT,
    help="Drop terms with fewer corpus hits before embedding",
  )
  args = parser.parse_args()

  data_dir = args.data_dir.resolve()
  out_path = args.out.resolve()

  term_freq = _collect_term_freq(data_dir)
  terms_sorted = [t for t, c in term_freq.most_common() if c >= args.min_term_count]
  print(
    f"Unique terms (>={args.min_term_count} hits): {len(terms_sorted):,}  |  "
    f"total token mentions: {sum(term_freq.values()):,}",
  )

  labels = list(CATEGORY_ANCHORS.keys())
  anchor_texts = list(CATEGORY_ANCHORS.values())

  model = get_model()
  print("Model:", get_model_name())

  t0 = time.perf_counter()
  a_mat = np.asarray(
    model.encode(
      anchor_texts,
      batch_size=8,
      normalize_embeddings=True,
      show_progress_bar=False,
    ),
    dtype=np.float32,
  )
  blocks: list[np.ndarray] = []
  for i in range(0, len(terms_sorted), TERM_BATCH):
    batch = [s[:MAX_TERM_CHARS] for s in terms_sorted[i : i + TERM_BATCH]]
    blocks.append(
      np.asarray(
        model.encode(
          batch,
          batch_size=TERM_BATCH,
          normalize_embeddings=True,
          show_progress_bar=False,
        ),
        dtype=np.float32,
      ),
    )
  t_mat = np.vstack(blocks)
  elapsed = time.perf_counter() - t0
  print(f"Encoded {len(terms_sorted):,} terms + {len(labels)} anchors in {elapsed:.1f}s")

  sim = t_mat @ a_mat.T
  best_i = sim.argmax(axis=1)
  best_s = sim[np.arange(sim.shape[0]), best_i]

  cat_mass: Counter[str] = Counter()
  for term, j, sc in zip(terms_sorted, best_i, best_s):
    cat = labels[int(j)] if float(sc) >= LOW_CONFIDENCE else "Low_confidence"
    cat_mass[cat] += term_freq[term]

  theme_payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "method": "embedding_nearest_anchor_v1",
    "low_confidence_cosine": LOW_CONFIDENCE,
    "buckets": [
      {"label": str(k), "weight": int(v)} for k, v in sorted(cat_mass.items(), key=lambda kv: -kv[1])
    ],
  }
  out_path.parent.mkdir(parents=True, exist_ok=True)
  out_path.write_text(json.dumps(theme_payload, indent=2), encoding="utf-8")
  print(f"Wrote {out_path}")


if __name__ == "__main__":
  main()
