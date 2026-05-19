"""Build ``project_term_theme_counts.json`` for the dashboard.

Edit ``THEME_TAXONOMY`` below to add categories and subcategories. The script assigns
each PROJECT_TERMS token to the nearest subcategory anchor, then writes:

- ``buckets`` — top-level category sizes for ``ProjectTermsThemeCloud``
- ``tree`` — category → subcategory → corpus terms for ``TermCloud`` (via ``/analytics/term-tree``)

Run:

  docker compose exec backend python indexer/build_project_term_theme_counts.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter, defaultdict
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
MAX_LEAVES_PER_SUBCATEGORY = 30

# Single source of truth — add categories/subcategories here; re-run this script after edits.
# Keys are internal ids; ``label`` is what the UI shows.
THEME_TAXONOMY: dict[str, dict[str, object]] = {
  "health": {
    "label": "Health",
    "anchor": (
      "Biomedical and clinical research: human disease, patients, hospitals, public health, "
      "epidemiology, nutrition, mental health, physiology, pharmacology, cancer, immunology, "
      "infectious disease, neuroscience, aging, exercise, biomarkers, clinical trials."
    ),
    "subcategories": {
      "Oncology": (
        "Cancer oncology tumors carcinogenesis metastasis chemotherapy radiation oncology "
        "tumor microenvironment neoplasms."
      ),
      "Cardiovascular": (
        "Heart disease cardiovascular stroke hypertension atherosclerosis cardiac arrhythmia "
        "vascular biology coronary artery disease."
      ),
      "Infectious Disease": (
        "Infectious disease pathogens HIV AIDS vaccine malaria tuberculosis antimicrobial "
        "resistance virology epidemics."
      ),
      "Mental Health": (
        "Mental health psychiatric disorders depression anxiety schizophrenia substance abuse "
        "behavioral health psychotherapy."
      ),
      "Public Health": (
        "Public health population health epidemiology health disparities obesity diabetes "
        "health literacy prevention."
      ),
      "Nutrition & Metabolism": (
        "Nutrition diet metabolism obesity diabetes endocrine metabolic syndrome micronutrients "
        "food intake caloric restriction."
      ),
    },
  },
  "life-sciences": {
    "label": "Life Sciences",
    "anchor": (
      "Basic life sciences: genetics, genomics, proteomics, biochemistry, cell biology, "
      "microbiology, developmental biology, molecular mechanisms, model organisms, immunology."
    ),
    "subcategories": {
      "Genomics & Genetics": (
        "Genomics genetics gene expression DNA sequencing epigenetics genome-wide association "
        "heredity molecular genetics."
      ),
      "Cell & Molecular Biology": (
        "Cell biology molecular biology protein RNA signal transduction stem cells organelles "
        "biochemistry pathways."
      ),
      "Neuroscience": (
        "Neuroscience brain neural circuits Alzheimer disease neuroimaging neurodegeneration "
        "synaptic transmission neurons."
      ),
      "Immunology": (
        "Immunology immune system adaptive immunity antibodies T-lymphocytes cytokines "
        "inflammation autoimmunity."
      ),
      "Microbiology & Virology": (
        "Microbiology bacteria viruses microbiome pathogen host interactions fermentation "
        "antimicrobial agents."
      ),
    },
  },
  "computing-ai": {
    "label": "Computing & AI",
    "anchor": (
      "Computer science, software, algorithms, machine learning, artificial intelligence, "
      "data science, databases, cybersecurity, visualization, high performance computing."
    ),
    "subcategories": {
      "Machine Learning & AI": (
        "Machine learning artificial intelligence deep learning neural networks reinforcement "
        "learning model training."
      ),
      "Data Science": (
        "Data science data analytics data mining statistical analysis algorithms biostatistics "
        "big data databases."
      ),
      "Bioinformatics": (
        "Bioinformatics computational genomics computational biology genome analysis protein "
        "structure sequence alignment."
      ),
      "Software & Systems": (
        "Software engineering high performance computing cloud computing data visualization "
        "cybersecurity distributed systems."
      ),
    },
  },
  "environmental": {
    "label": "Environmental",
    "anchor": (
      "Environmental, climate, ecology, ocean, atmospheric, geology, hydrology, sustainability, "
      "conservation, natural resources."
    ),
    "subcategories": {
      "Climate & Atmosphere": (
        "Climate change atmospheric sciences air pollution greenhouse gases meteorology "
        "global warming."
      ),
      "Ecology & Conservation": (
        "Ecology ecosystem biodiversity conservation wildlife habitat restoration "
        "environmental protection."
      ),
      "Water & Earth": (
        "Water quality hydrology marine biology soil science environmental health oceans "
        "groundwater geosciences."
      ),
      "Agriculture & Food Systems": (
        "Agriculture crops livestock food security sustainable agriculture agronomy soil "
        "fertility pest management."
      ),
    },
  },
  "engineering": {
    "label": "Engineering",
    "anchor": (
      "Engineering and applied technology: mechanical, electrical, materials, chemical, robotics, "
      "sensors, manufacturing, nanotechnology, energy systems, biomedical devices."
    ),
    "subcategories": {
      "Biomedical Engineering": (
        "Biomedical engineering bioengineering biomaterials drug delivery medical devices "
        "tissue engineering prosthetics."
      ),
      "Nanotechnology": (
        "Nanotechnology nanoscale engineering nanoparticles nanomedicine nanostructures "
        "materials science at nanoscale."
      ),
      "Robotics & Sensors": (
        "Robotics biosensors imaging technology wearable devices point-of-care instrumentation "
        "automation control."
      ),
      "Energy & Materials": (
        "Energy storage batteries fuel cells renewable energy materials science composites "
        "catalysis chemical engineering."
      ),
    },
  },
  "edu-social": {
    "label": "Education & Social Sciences",
    "anchor": (
      "Social, behavioral, economic, and education research: psychology, sociology, policy, "
      "inequality, schools, learning sciences, workforce training, surveys."
    ),
    "subcategories": {
      "Health Education": (
        "Health education patient education curriculum training workforce development "
        "mentoring teaching."
      ),
      "Behavioral Sciences": (
        "Behavioral research psychology cognitive science decision making motivation "
        "human behavior experiments."
      ),
      "Social Determinants": (
        "Health inequities minority health social factors rural health health equity "
        "socioeconomic determinants."
      ),
      "Policy & Implementation": (
        "Health policy implementation science community health program evaluation "
        "health services research."
      ),
      "Economics & Workforce": (
        "Health economics labor markets workforce policy cost-effectiveness health systems "
        "organizational behavior."
      ),
    },
  },
}

LOW_CONFIDENCE_ID = "low-confidence"
LOW_CONFIDENCE_SUB = "Unclassified"


def _slugify(value: str) -> str:
  slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
  return slug or "term"


def _resolve_data_dir(explicit: Path | None) -> Path:
  candidates: list[Path] = []
  if explicit is not None:
    candidates.append(explicit.resolve())
  candidates.extend([DATA_DIR.resolve(), Path("/app").resolve(), _BACKEND.resolve()])
  seen: set[Path] = set()
  for directory in candidates:
    if directory in seen or not directory.is_dir():
      continue
    seen.add(directory)
    if any(directory.glob("*_data.csv")):
      return directory
  raise FileNotFoundError(
    "No *_data.csv found under indexer/data/, /app/, or backend/. "
    "Add NIH exports before running this script.",
  )


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


def _flatten_sub_anchors() -> list[dict[str, str]]:
  rows: list[dict[str, str]] = []
  for cat_id, cat in THEME_TAXONOMY.items():
    cat_label = str(cat["label"])
    subcats = cat.get("subcategories")
    if not isinstance(subcats, dict):
      continue
    for sub_label, anchor_text in subcats.items():
      sub_id = f"{cat_id}.{_slugify(str(sub_label))}"
      rows.append(
        {
          "category_id": cat_id,
          "category_label": cat_label,
          "subcategory_label": str(sub_label),
          "subcategory_id": sub_id,
          "anchor_text": str(anchor_text),
        },
      )
  rows.append(
    {
      "category_id": LOW_CONFIDENCE_ID,
      "category_label": "Low confidence",
      "subcategory_label": LOW_CONFIDENCE_SUB,
      "subcategory_id": f"{LOW_CONFIDENCE_ID}.unclassified",
      "anchor_text": "Ambiguous or weakly matching project terms.",
    },
  )
  return rows


def _build_tree(
  cat_mass: Counter[str],
  subcat_mass: Counter[tuple[str, str]],
  subcat_terms: dict[tuple[str, str], list[tuple[str, int]]],
) -> list[dict[str, object]]:
  tree: list[dict[str, object]] = []

  for cat_id, cat in THEME_TAXONOMY.items():
    if cat_mass[cat_id] <= 0:
      continue
    cat_label = str(cat["label"])
    subcats = cat.get("subcategories")
    if not isinstance(subcats, dict):
      continue
    sub_nodes: list[dict[str, object]] = []

    for sub_label in subcats:
      mass = subcat_mass[(cat_id, str(sub_label))]
      if mass <= 0:
        continue
      terms = subcat_terms.get((cat_id, str(sub_label)), [])
      terms_sorted = sorted(terms, key=lambda item: (-item[1], item[0]))[:MAX_LEAVES_PER_SUBCATEGORY]
      if not terms_sorted:
        continue
      sub_id = f"{cat_id}.{_slugify(str(sub_label))}"
      sub_nodes.append(
        {
          "id": sub_id,
          "label": str(sub_label),
          "weight": int(mass),
          "children": [
            {
              "id": f"{sub_id}.{_slugify(term)}",
              "label": term,
              "weight": int(freq),
            }
            for term, freq in terms_sorted
          ],
        },
      )

    sub_nodes.sort(key=lambda node: int(node.get("weight", 0)), reverse=True)
    if sub_nodes:
      tree.append(
        {
          "id": cat_id,
          "label": cat_label,
          "weight": int(cat_mass[cat_id]),
          "children": sub_nodes,
        },
      )

  if cat_mass[LOW_CONFIDENCE_ID] > 0:
    lc_mass = int(cat_mass[LOW_CONFIDENCE_ID])
    terms = subcat_terms.get((LOW_CONFIDENCE_ID, LOW_CONFIDENCE_SUB), [])
    terms_sorted = sorted(terms, key=lambda item: (-item[1], item[0]))[:MAX_LEAVES_PER_SUBCATEGORY]
    lc_children: list[dict[str, object]] = []
    if terms_sorted:
      sub_id = f"{LOW_CONFIDENCE_ID}.unclassified"
      lc_children.append(
        {
          "id": sub_id,
          "label": LOW_CONFIDENCE_SUB,
          "weight": lc_mass,
          "children": [
            {"id": f"{sub_id}.{_slugify(term)}", "label": term, "weight": int(freq)}
            for term, freq in terms_sorted
          ],
        },
      )
    tree.append(
      {
        "id": LOW_CONFIDENCE_ID,
        "label": "Low confidence",
        "weight": lc_mass,
        "children": lc_children,
      },
    )

  return tree


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  parser.add_argument("--min-term-count", type=int, default=MIN_TERM_COUNT)
  args = parser.parse_args()

  data_dir = _resolve_data_dir(None if args.data_dir == DATA_DIR else args.data_dir)
  out_path = args.out.resolve()
  print(f"Using data dir: {data_dir}")

  term_freq = _collect_term_freq(data_dir)
  terms_sorted = [t for t, c in term_freq.most_common() if c >= args.min_term_count]
  print(
    f"Unique terms (>={args.min_term_count} hits): {len(terms_sorted):,}  |  "
    f"total token mentions: {sum(term_freq.values()):,}",
  )

  sub_rows = _flatten_sub_anchors()
  anchor_texts = [row["anchor_text"] for row in sub_rows]

  model = get_model()
  print("Model:", get_model_name())

  t0 = time.perf_counter()
  a_mat = np.asarray(
    model.encode(anchor_texts, batch_size=16, normalize_embeddings=True, show_progress_bar=False),
    dtype=np.float32,
  )
  blocks: list[np.ndarray] = []
  for i in range(0, len(terms_sorted), TERM_BATCH):
    batch = [s[:MAX_TERM_CHARS] for s in terms_sorted[i : i + TERM_BATCH]]
    blocks.append(
      np.asarray(
        model.encode(batch, batch_size=TERM_BATCH, normalize_embeddings=True, show_progress_bar=False),
        dtype=np.float32,
      ),
    )
  t_mat = np.vstack(blocks)
  print(f"Encoded {len(terms_sorted):,} terms + {len(sub_rows)} subcategory anchors in {time.perf_counter() - t0:.1f}s")

  sim = t_mat @ a_mat.T
  best_i = sim.argmax(axis=1)
  best_s = sim[np.arange(sim.shape[0]), best_i]

  cat_mass: Counter[str] = Counter()
  subcat_mass: Counter[tuple[str, str]] = Counter()
  subcat_terms: dict[tuple[str, str], list[tuple[str, int]]] = defaultdict(list)
  label_by_cat_id = {cid: str(cat["label"]) for cid, cat in THEME_TAXONOMY.items()}
  label_by_cat_id[LOW_CONFIDENCE_ID] = "Low confidence"

  for term, j, sc in zip(terms_sorted, best_i, best_s):
    row = sub_rows[int(j)]
    hits = term_freq[term]
    if float(sc) < LOW_CONFIDENCE:
      cat_id = LOW_CONFIDENCE_ID
      sub_label = LOW_CONFIDENCE_SUB
    else:
      cat_id = row["category_id"]
      sub_label = row["subcategory_label"]
    cat_mass[cat_id] += hits
    subcat_mass[(cat_id, sub_label)] += hits
    subcat_terms[(cat_id, sub_label)].append((term, hits))

  tree = _build_tree(cat_mass, subcat_mass, subcat_terms)
  buckets = [
    {"label": label_by_cat_id[cat_id], "weight": int(weight)}
    for cat_id, weight in sorted(cat_mass.items(), key=lambda item: -item[1])
    if weight > 0
  ]

  theme_payload = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "method": "embedding_nearest_subcategory",
    "low_confidence_cosine": LOW_CONFIDENCE,
    "max_leaves_per_subcategory": MAX_LEAVES_PER_SUBCATEGORY,
    "buckets": buckets,
    "tree": tree,
  }
  out_path.write_text(json.dumps(theme_payload, indent=2), encoding="utf-8")
  print(f"Wrote {out_path}  |  categories: {len(buckets)}  |  tree roots: {len(tree)}")


if __name__ == "__main__":
  main()
