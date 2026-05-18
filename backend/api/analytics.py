"""Analytics and chart-focused API endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .opensearch_client import get_client, get_index_name
from .query_filters import analytics_filter_params, with_query_filters

router = APIRouter()
INDEX_NAME = get_index_name()

# Precomputed in `proj_data_analysis.ipynb` (embedding→theme cell): theme masses for dashboard word cloud.
_THEME_COUNTS_PATH = Path(__file__).resolve().parent.parent / "indexer" / "project_term_theme_counts.json"

# Static 3-level hierarchy of NIH research term categories for the frontend term-cloud browser.
# IDs use dot-notation; leaf labels are drawn from NIH PROJECT_TERMS vocabulary.
_TERM_HIERARCHY: list[dict[str, object]] = [
  {
    "id": "health",
    "label": "Health",
    "children": [
      {
        "id": "health.oncology",
        "label": "Oncology",
        "children": [
          {"id": "health.oncology.cancer", "label": "Cancer"},
          {"id": "health.oncology.tumor", "label": "Tumor"},
          {"id": "health.oncology.carcinogenesis", "label": "Carcinogenesis"},
          {"id": "health.oncology.cancer-prevention", "label": "Cancer Prevention"},
          {"id": "health.oncology.cancer-biomarkers", "label": "Cancer Biomarkers"},
          {"id": "health.oncology.metastasis", "label": "Metastasis"},
        ],
      },
      {
        "id": "health.cardiovascular",
        "label": "Cardiovascular",
        "children": [
          {"id": "health.cardiovascular.heart-disease", "label": "Heart Disease"},
          {"id": "health.cardiovascular.stroke", "label": "Stroke"},
          {"id": "health.cardiovascular.hypertension", "label": "Hypertension"},
          {"id": "health.cardiovascular.atherosclerosis", "label": "Atherosclerosis"},
          {"id": "health.cardiovascular.cardiac", "label": "Cardiac"},
          {"id": "health.cardiovascular.vascular-biology", "label": "Vascular Biology"},
        ],
      },
      {
        "id": "health.infectious-disease",
        "label": "Infectious Disease",
        "children": [
          {"id": "health.infectious-disease.hiv", "label": "HIV"},
          {"id": "health.infectious-disease.pathogen-biology", "label": "Pathogen Biology"},
          {"id": "health.infectious-disease.vaccine", "label": "Vaccine"},
          {"id": "health.infectious-disease.malaria", "label": "Malaria"},
          {"id": "health.infectious-disease.tuberculosis", "label": "Tuberculosis"},
          {"id": "health.infectious-disease.antimicrobial-resistance", "label": "Antimicrobial Resistance"},
        ],
      },
      {
        "id": "health.mental-health",
        "label": "Mental Health",
        "children": [
          {"id": "health.mental-health.psychiatric-disorders", "label": "Psychiatric Disorders"},
          {"id": "health.mental-health.depression", "label": "Depression"},
          {"id": "health.mental-health.anxiety", "label": "Anxiety"},
          {"id": "health.mental-health.schizophrenia", "label": "Schizophrenia"},
          {"id": "health.mental-health.substance-abuse", "label": "Substance Abuse"},
          {"id": "health.mental-health.behavioral-health", "label": "Behavioral Health"},
        ],
      },
      {
        "id": "health.public-health",
        "label": "Public Health",
        "children": [
          {"id": "health.public-health.population-health", "label": "Population Health"},
          {"id": "health.public-health.epidemiology", "label": "Epidemiology"},
          {"id": "health.public-health.health-disparities", "label": "Health Disparities"},
          {"id": "health.public-health.obesity", "label": "Obesity"},
          {"id": "health.public-health.diabetes", "label": "Diabetes"},
          {"id": "health.public-health.health-literacy", "label": "Health Literacy"},
        ],
      },
    ],
  },
  {
    "id": "life-sciences",
    "label": "Life Sciences",
    "children": [
      {
        "id": "life-sciences.genomics-genetics",
        "label": "Genomics & Genetics",
        "children": [
          {"id": "life-sciences.genomics-genetics.genomics", "label": "Genomics"},
          {"id": "life-sciences.genomics-genetics.genetics", "label": "Genetics"},
          {"id": "life-sciences.genomics-genetics.gene-expression", "label": "Gene Expression"},
          {"id": "life-sciences.genomics-genetics.dna-sequencing", "label": "DNA Sequencing"},
          {"id": "life-sciences.genomics-genetics.epigenetics", "label": "Epigenetics"},
          {"id": "life-sciences.genomics-genetics.gwas", "label": "Genome-Wide Association"},
        ],
      },
      {
        "id": "life-sciences.cell-molecular-biology",
        "label": "Cell & Molecular Biology",
        "children": [
          {"id": "life-sciences.cell-molecular-biology.cell-biology", "label": "Cell Biology"},
          {"id": "life-sciences.cell-molecular-biology.molecular-biology", "label": "Molecular Biology"},
          {"id": "life-sciences.cell-molecular-biology.protein", "label": "Protein"},
          {"id": "life-sciences.cell-molecular-biology.rna", "label": "RNA"},
          {"id": "life-sciences.cell-molecular-biology.signal-transduction", "label": "Signal Transduction"},
          {"id": "life-sciences.cell-molecular-biology.stem-cells", "label": "Stem Cells"},
        ],
      },
      {
        "id": "life-sciences.neuroscience",
        "label": "Neuroscience",
        "children": [
          {"id": "life-sciences.neuroscience.brain", "label": "Brain"},
          {"id": "life-sciences.neuroscience.neural-circuits", "label": "Neural Circuits"},
          {"id": "life-sciences.neuroscience.alzheimer-disease", "label": "Alzheimer Disease"},
          {"id": "life-sciences.neuroscience.neuroimaging", "label": "Neuroimaging"},
          {"id": "life-sciences.neuroscience.neurodegeneration", "label": "Neurodegeneration"},
          {"id": "life-sciences.neuroscience.synaptic-transmission", "label": "Synaptic Transmission"},
        ],
      },
      {
        "id": "life-sciences.immunology",
        "label": "Immunology",
        "children": [
          {"id": "life-sciences.immunology.immune-system", "label": "Immune System"},
          {"id": "life-sciences.immunology.adaptive-immunity", "label": "Adaptive Immunity"},
          {"id": "life-sciences.immunology.antibodies", "label": "Antibodies"},
          {"id": "life-sciences.immunology.t-lymphocytes", "label": "T-Lymphocytes"},
          {"id": "life-sciences.immunology.cytokines", "label": "Cytokines"},
          {"id": "life-sciences.immunology.inflammation", "label": "Inflammation"},
        ],
      },
    ],
  },
  {
    "id": "computing-ai",
    "label": "Computing & AI",
    "children": [
      {
        "id": "computing-ai.machine-learning",
        "label": "Machine Learning & AI",
        "children": [
          {"id": "computing-ai.machine-learning.machine-learning", "label": "Machine Learning"},
          {"id": "computing-ai.machine-learning.artificial-intelligence", "label": "Artificial Intelligence"},
          {"id": "computing-ai.machine-learning.deep-learning", "label": "Deep Learning"},
          {"id": "computing-ai.machine-learning.neural-network", "label": "Neural Network"},
          {"id": "computing-ai.machine-learning.nlp", "label": "Natural Language Processing"},
        ],
      },
      {
        "id": "computing-ai.data-science",
        "label": "Data Science",
        "children": [
          {"id": "computing-ai.data-science.data-analytics", "label": "Data Analytics"},
          {"id": "computing-ai.data-science.data-mining", "label": "Data Mining"},
          {"id": "computing-ai.data-science.statistical-analysis", "label": "Statistical Analysis"},
          {"id": "computing-ai.data-science.algorithms", "label": "Algorithms"},
          {"id": "computing-ai.data-science.biostatistics", "label": "Biostatistics"},
          {"id": "computing-ai.data-science.big-data", "label": "Big Data"},
        ],
      },
      {
        "id": "computing-ai.bioinformatics",
        "label": "Bioinformatics",
        "children": [
          {"id": "computing-ai.bioinformatics.computational-genomics", "label": "Computational Genomics"},
          {"id": "computing-ai.bioinformatics.computational-biology", "label": "Computational Biology"},
          {"id": "computing-ai.bioinformatics.genome-analysis", "label": "Genome Analysis"},
          {"id": "computing-ai.bioinformatics.protein-structure", "label": "Protein Structure"},
          {"id": "computing-ai.bioinformatics.sequence-analysis", "label": "Sequence Analysis"},
        ],
      },
      {
        "id": "computing-ai.software-systems",
        "label": "Software & Systems",
        "children": [
          {"id": "computing-ai.software-systems.software", "label": "Software"},
          {"id": "computing-ai.software-systems.hpc", "label": "High Performance Computing"},
          {"id": "computing-ai.software-systems.cloud-computing", "label": "Cloud Computing"},
          {"id": "computing-ai.software-systems.data-visualization", "label": "Data Visualization"},
        ],
      },
    ],
  },
  {
    "id": "environmental",
    "label": "Environmental",
    "children": [
      {
        "id": "environmental.climate-atmosphere",
        "label": "Climate & Atmosphere",
        "children": [
          {"id": "environmental.climate-atmosphere.climate", "label": "Climate"},
          {"id": "environmental.climate-atmosphere.air-pollution", "label": "Air Pollution"},
          {"id": "environmental.climate-atmosphere.climate-change", "label": "Climate Change"},
          {"id": "environmental.climate-atmosphere.atmospheric-sciences", "label": "Atmospheric Sciences"},
          {"id": "environmental.climate-atmosphere.greenhouse-gases", "label": "Greenhouse Gases"},
        ],
      },
      {
        "id": "environmental.ecology-conservation",
        "label": "Ecology & Conservation",
        "children": [
          {"id": "environmental.ecology-conservation.ecology", "label": "Ecology"},
          {"id": "environmental.ecology-conservation.ecosystem", "label": "Ecosystem"},
          {"id": "environmental.ecology-conservation.biodiversity", "label": "Biodiversity"},
          {"id": "environmental.ecology-conservation.conservation", "label": "Conservation"},
          {"id": "environmental.ecology-conservation.wildlife", "label": "Wildlife"},
        ],
      },
      {
        "id": "environmental.water-earth",
        "label": "Water & Earth",
        "children": [
          {"id": "environmental.water-earth.water-quality", "label": "Water Quality"},
          {"id": "environmental.water-earth.hydrology", "label": "Hydrology"},
          {"id": "environmental.water-earth.marine-biology", "label": "Marine Biology"},
          {"id": "environmental.water-earth.soil-science", "label": "Soil Science"},
          {"id": "environmental.water-earth.environmental-health", "label": "Environmental Health"},
        ],
      },
    ],
  },
  {
    "id": "engineering",
    "label": "Engineering",
    "children": [
      {
        "id": "engineering.biomedical",
        "label": "Biomedical Engineering",
        "children": [
          {"id": "engineering.biomedical.bioengineering", "label": "Bioengineering"},
          {"id": "engineering.biomedical.biomaterials", "label": "Biomaterials"},
          {"id": "engineering.biomedical.drug-delivery", "label": "Drug Delivery"},
          {"id": "engineering.biomedical.medical-devices", "label": "Medical Devices"},
          {"id": "engineering.biomedical.tissue-engineering", "label": "Tissue Engineering"},
          {"id": "engineering.biomedical.prosthetics", "label": "Prosthetics"},
        ],
      },
      {
        "id": "engineering.nanotechnology",
        "label": "Nanotechnology",
        "children": [
          {"id": "engineering.nanotechnology.nanoscale-engineering", "label": "Nanoscale Engineering"},
          {"id": "engineering.nanotechnology.nanoparticles", "label": "Nanoparticles"},
          {"id": "engineering.nanotechnology.nanomedicine", "label": "Nanomedicine"},
          {"id": "engineering.nanotechnology.nanostructures", "label": "Nanostructures"},
        ],
      },
      {
        "id": "engineering.robotics-sensors",
        "label": "Robotics & Sensors",
        "children": [
          {"id": "engineering.robotics-sensors.robotics", "label": "Robotics"},
          {"id": "engineering.robotics-sensors.biosensors", "label": "Biosensors"},
          {"id": "engineering.robotics-sensors.imaging-technology", "label": "Imaging Technology"},
          {"id": "engineering.robotics-sensors.wearable-devices", "label": "Wearable Devices"},
          {"id": "engineering.robotics-sensors.point-of-care", "label": "Point-of-Care"},
        ],
      },
    ],
  },
  {
    "id": "edu-social",
    "label": "Education & Social Sciences",
    "children": [
      {
        "id": "edu-social.health-education",
        "label": "Health Education",
        "children": [
          {"id": "edu-social.health-education.patient-education", "label": "Patient Education"},
          {"id": "edu-social.health-education.curriculum", "label": "Curriculum"},
          {"id": "edu-social.health-education.training", "label": "Training"},
          {"id": "edu-social.health-education.workforce-development", "label": "Workforce Development"},
          {"id": "edu-social.health-education.mentoring", "label": "Mentoring"},
        ],
      },
      {
        "id": "edu-social.behavioral-sciences",
        "label": "Behavioral Sciences",
        "children": [
          {"id": "edu-social.behavioral-sciences.behavioral-research", "label": "Behavioral Research"},
          {"id": "edu-social.behavioral-sciences.psychology", "label": "Psychology"},
          {"id": "edu-social.behavioral-sciences.cognitive-science", "label": "Cognitive Science"},
          {"id": "edu-social.behavioral-sciences.decision-making", "label": "Decision Making"},
          {"id": "edu-social.behavioral-sciences.motivation", "label": "Motivation"},
        ],
      },
      {
        "id": "edu-social.social-determinants",
        "label": "Social Determinants",
        "children": [
          {"id": "edu-social.social-determinants.health-inequities", "label": "Health Inequities"},
          {"id": "edu-social.social-determinants.minority-health", "label": "Minority Health"},
          {"id": "edu-social.social-determinants.social-factors", "label": "Social Factors"},
          {"id": "edu-social.social-determinants.rural-health", "label": "Rural Health"},
          {"id": "edu-social.social-determinants.health-equity", "label": "Health Equity"},
        ],
      },
      {
        "id": "edu-social.policy-implementation",
        "label": "Policy & Implementation",
        "children": [
          {"id": "edu-social.policy-implementation.health-policy", "label": "Health Policy"},
          {"id": "edu-social.policy-implementation.implementation-science", "label": "Implementation Science"},
          {"id": "edu-social.policy-implementation.community-health", "label": "Community Health"},
          {"id": "edu-social.policy-implementation.program-evaluation", "label": "Program Evaluation"},
        ],
      },
    ],
  },
]


def get_funding_value(source: dict[str, object]) -> float:
  """Use first available numeric funding field."""
  for field in ("TOTAL_COST", "TOTAL_COST_SUB_PROJECT", "DIRECT_COST_AMT", "INDIRECT_COST_AMT"):
    raw = source.get(field)
    if raw is None or raw == "":
      continue
    try:
      return float(raw)
    except (TypeError, ValueError):
      continue
  return 0.0


@router.get("/summary")
def analytics_summary(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
) -> dict[str, object]:
  client = get_client()
  body = with_query_filters(
    {
      "size": 0,
      "track_total_hits": True,
      "aggs": {
        # Use ACTIVITY as the dashboard category grouping for NIH project data.
        "categories": {"terms": {"field": "ACTIVITY.keyword", "size": 10}},
        "total_funding": {"sum": {"field": "TOTAL_COST"}},
        "unique_ics": {"cardinality": {"field": "IC_NAME.keyword"}},
        "unique_activities": {"cardinality": {"field": "ACTIVITY.keyword"}},
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)

  total = response.get("hits", {}).get("total", {})
  total_documents = total.get("value", 0) if isinstance(total, dict) else total
  aggs = response.get("aggregations", {})
  buckets = aggs.get("categories", {}).get("buckets", [])

  return {
    "total_documents": total_documents,
    "total_funding": aggs.get("total_funding", {}).get("value", 0.0),
    "unique_ics": aggs.get("unique_ics", {}).get("value", 0),
    "unique_activities": aggs.get("unique_activities", {}).get("value", 0),
    "by_category": [{"label": b["key"], "value": b["doc_count"]} for b in buckets],
    "time_series": [],
  }


@router.get("/by-state")
def analytics_by_state(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
) -> list[dict[str, object]]:
  client = get_client()
  body = with_query_filters(
    {
      "size": 0,
      "aggs": {
        "by_state": {
          "terms": {"field": "ORG_STATE.keyword", "size": 60},
          "aggs": {
            "total_funding": {"sum": {"field": "TOTAL_COST"}},
          },
        },
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_state", {}).get("buckets", [])

  results = [
    {
      "state": b["key"],
      "count": b["doc_count"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
    }
    for b in buckets
  ]
  results.sort(key=lambda x: x["total_funding"], reverse=True)
  return results


@router.get("/by-ic")
def analytics_by_ic(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
  fy: int | None = Query(default=None, ge=2000, le=2100, description="Optional fiscal year filter"),
) -> list[dict[str, object]]:
  client = get_client()
  all_ics_agg = {
    "terms": {
      "field": "IC_NAME.keyword",
      "size": 100,
      "order": {"_key": "asc"},
    },
  }

  if fy is None:
    body = with_query_filters({"size": 0, "aggs": {"all_ics": all_ics_agg}}, filters)
    response = client.search(index=INDEX_NAME, body=body)
    buckets = response.get("aggregations", {}).get("all_ics", {}).get("buckets", [])
    return [{"label": b["key"], "value": b["doc_count"]} for b in buckets]

  body = with_query_filters(
    {
      "size": 0,
      "aggs": {
        "all_ics": all_ics_agg,
        "fy_filter": {
          "filter": {"term": {"FY": fy}},
          "aggs": {
            "by_ic": {
              "terms": {"field": "IC_NAME.keyword", "size": 100},
            },
          },
        },
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)
  all_buckets = response.get("aggregations", {}).get("all_ics", {}).get("buckets", [])
  fy_buckets = (
    response.get("aggregations", {})
    .get("fy_filter", {})
    .get("by_ic", {})
    .get("buckets", [])
  )
  counts = {b["key"]: b["doc_count"] for b in fy_buckets}

  return [{"label": b["key"], "value": counts.get(b["key"], 0)} for b in all_buckets]


def _activity_funding_buckets(
  client: object,
  *,
  bucket_size: int,
  filters: list[dict[str, object]] | None = None,
) -> tuple[list[dict[str, object]], dict[str, object]]:
  """Return (activity buckets, root aggregations) from a single search."""
  size = max(1, min(bucket_size, 500))
  body = with_query_filters(
    {
      "size": 0,
      "track_total_hits": True,
      "aggs": {
        "total_funding_all": {"sum": {"field": "TOTAL_COST"}},
        "by_activity": {
          "terms": {
            "field": "ACTIVITY.keyword",
            "size": size,
            "order": {"total_funding": "desc"},
            "show_term_doc_count_error": True,
          },
          "aggs": {
            "total_funding": {"sum": {"field": "TOTAL_COST"}},
          },
        },
      },
    },
    filters or [],
  )
  response = client.search(index=INDEX_NAME, body=body)
  aggs = response.get("aggregations", {})
  buckets = aggs.get("by_activity", {}).get("buckets", [])
  return buckets, aggs


@router.get("/by-activity")
def analytics_by_activity(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
  limit: int = Query(default=50, ge=1, le=200, description="Max activity codes to return"),
) -> list[dict[str, object]]:
  client = get_client()
  buckets, _ = _activity_funding_buckets(client, bucket_size=limit, filters=filters)

  results = [
    {
      "label": b["key"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
      "count": b["doc_count"],
    }
    for b in buckets
  ]
  return results


@router.get("/by-activity-funding-pie")
def analytics_by_activity_funding_pie(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
  limit: int = Query(
    default=80,
    ge=10,
    le=500,
    description="How many activity buckets to pull from OpenSearch (ordered by funding)",
  ),
  pie_slices: int = Query(
    default=12,
    ge=3,
    le=24,
    description="Number of top-funded activity codes on the pie",
  ),
  merge_other: bool = Query(
    default=False,
    description=(
      "If true, aggregate remaining buckets into one Other slice. "
      "If false (default), pie shows only top codes; see remainder."
    ),
  ),
) -> dict[str, object]:
  """JSON for dashboard pie: activity code share of TOTAL_COST (indexed data = export pipeline)."""
  client = get_client()
  buckets, aggs = _activity_funding_buckets(client, bucket_size=limit, filters=filters)
  global_total = float(aggs.get("total_funding_all", {}).get("value") or 0.0)

  rows = [
    {
      "label": str(b["key"]),
      "total_funding": float(b.get("total_funding", {}).get("value") or 0.0),
      "count": int(b["doc_count"]),
    }
    for b in buckets
  ]

  denom = global_total if global_total > 0 else sum(r["total_funding"] for r in rows) or 1.0

  def with_pct(r: dict[str, object]) -> dict[str, object]:
    funding = float(r["total_funding"])
    return {
      **r,
      "percent_of_funding": round(funding / denom, 6) if denom else 0.0,
    }

  other: dict[str, object] | None = None
  remainder: dict[str, object] | None = None

  if merge_other:
    if len(rows) <= pie_slices:
      slices = [with_pct(r) for r in rows]
    else:
      head = rows[:pie_slices]
      tail = rows[pie_slices:]
      other_funding = sum(r["total_funding"] for r in tail)
      other_count = sum(r["count"] for r in tail)
      slices = [with_pct(r) for r in head]
      if other_funding > 0 or other_count > 0:
        other = with_pct(
          {
            "label": f"Other ({len(tail)} codes)",
            "total_funding": other_funding,
            "count": other_count,
          },
        )
  else:
    head = rows[:pie_slices]
    tail = rows[pie_slices:]
    slices = [with_pct(r) for r in head]
    if tail:
      rem_funding = sum(r["total_funding"] for r in tail)
      rem_count = sum(r["count"] for r in tail)
      remainder = {
        "codes_in_tail": len(tail),
        "total_funding": rem_funding,
        "project_count": rem_count,
        "percent_of_all_indexed": round(rem_funding / denom, 6) if denom else 0.0,
      }

  tail_slices: list[dict[str, object]] = []
  if not merge_other and len(rows) > pie_slices:
    tail_slices = [with_pct(r) for r in rows[pie_slices:]]

  by_activity_meta = aggs.get("by_activity", {})
  sum_other_doc_count = int(by_activity_meta.get("sum_other_doc_count") or 0)

  return {
    "total_funding_indexed": global_total,
    "activity_buckets_fetched": len(rows),
    "pie_slices_cap": pie_slices,
    "merge_other": merge_other,
    "denominator": "total_funding_all" if global_total > 0 else "sum_of_returned_buckets",
    "slices": slices,
    "tail_slices": tail_slices,
    "other": other,
    "remainder": remainder,
    "sum_other_doc_count": sum_other_doc_count,
    "more_activities_than_buckets": sum_other_doc_count > 0,
  }


@router.get("/project-term-theme-cloud")
def analytics_project_term_theme_cloud() -> dict[str, object]:
  """Precomputed theme masses for the dashboard word cloud.

  Generated offline — either ``indexer/build_project_term_theme_counts.py`` or the
  matching cell in ``proj_data_analysis.ipynb`` — writing
  ``backend/indexer/project_term_theme_counts.json``.
  """
  path = _THEME_COUNTS_PATH
  if not path.is_file():
    return {
      "generated_at": None,
      "method": None,
      "buckets": [],
      "source_path": str(path),
      "message": "No project_term_theme_counts.json yet — run the notebook theme cell to create it.",
    }
  try:
    payload = json.loads(path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError) as exc:
    raise HTTPException(status_code=500, detail=f"Invalid theme JSON: {exc}") from exc

  buckets = payload.get("buckets")
  if not isinstance(buckets, list):
    buckets = []
  tree = payload.get("tree")
  if not isinstance(tree, list):
    tree = []
  return {
    "generated_at": payload.get("generated_at"),
    "method": payload.get("method"),
    "low_confidence_cosine": payload.get("low_confidence_cosine"),
    "buckets": buckets,
    "tree": tree,
    "source_path": str(path.resolve()),
  }


@router.get("/by-year")
def analytics_by_year(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
) -> list[dict[str, object]]:
  client = get_client()
  body = with_query_filters(
    {
      "size": 0,
      "aggs": {
        "by_year": {
          "terms": {
            "field": "FY",
            "size": 20,
            "order": {"_key": "asc"},
          },
          "aggs": {
            "total_funding": {"sum": {"field": "TOTAL_COST"}},
          },
        },
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_year", {}).get("buckets", [])

  return [
    {
      "year": int(b["key"]),
      "count": b["doc_count"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
    }
    for b in buckets
  ]


@router.get("/top-orgs")
def analytics_top_orgs(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
) -> list[dict[str, object]]:
  client = get_client()
  body = with_query_filters(
    {
      "size": 0,
      "aggs": {
        "top_orgs": {
          "terms": {
            "field": "ORG_NAME.keyword",
            "size": 15,
            "order": {"total_funding": "desc"},
          },
          "aggs": {
            "total_funding": {"sum": {"field": "TOTAL_COST"}},
          },
        },
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("top_orgs", {}).get("buckets", [])

  return [
    {
      "label": b["key"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
    }
    for b in buckets
  ]


@router.get("/avg-grant-by-ic")
def analytics_avg_grant_by_ic(
  filters: Annotated[list[dict[str, object]], Depends(analytics_filter_params)],
) -> list[dict[str, object]]:
  client = get_client()
  body = with_query_filters(
    {
      "size": 0,
      "aggs": {
        "by_ic": {
          "terms": {
            "field": "IC_NAME.keyword",
            "size": 100,
            "order": {"avg_grant": "desc"},
          },
          "aggs": {
            "avg_grant": {"avg": {"field": "TOTAL_COST"}},
          },
        },
      },
    },
    filters,
  )
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_ic", {}).get("buckets", [])

  return [
    {
      "label": b["key"],
      "avg_grant": b.get("avg_grant", {}).get("value", 0.0),
    }
    for b in buckets
  ]


@router.get("/by-activity-terms")
def analytics_by_activity_terms(
  activity_id: str = Query(..., description="Activity code, e.g. R01"),
  limit: int = Query(default=25, ge=1, le=100),
) -> dict[str, object]:
  client = get_client()
  body = {
    "size": 0,
    "query": {
      "bool": {
        "filter": [
          {"term": {"ACTIVITY.keyword": activity_id}},
        ],
      },
    },
    "aggs": {
      "by_term": {
        "terms": {
          "field": "PROJECT_TERMS.keyword",
          "size": limit,
        },
        "aggs": {
          "total_funding": {"sum": {"field": "TOTAL_COST"}},
        },
      },
    },
  }
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_term", {}).get("buckets", [])

  data = [
    {
      "label": b["key"],
      "count": b["doc_count"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
    }
    for b in buckets
  ]
  data.sort(key=lambda x: x["total_funding"], reverse=True)

  return {
    "activity_id": activity_id,
    "limit": limit,
    "data": data,
  }


@router.get("/by-activity-project-compare")
def analytics_by_activity_project_compare(
  project_id: str = Query(..., description="OpenSearch document ID for selected project"),
  activity_id: str = Query(..., description="Activity code, e.g. R01"),
  limit: int = Query(default=20, ge=1, le=20),
) -> dict[str, object]:
  client = get_client()

  try:
    selected = client.get(index=INDEX_NAME, id=project_id)
  except Exception as exc:
    raise HTTPException(status_code=404, detail="Selected project not found") from exc

  source = selected.get("_source", {})
  selected_title = source.get("PROJECT_TITLE") or f"Project {project_id}"
  selected_cost_value = get_funding_value(source)

  peers_response = client.search(
    index=INDEX_NAME,
    body={
      "size": limit,
      "_source": [
        "PROJECT_TITLE",
        "TOTAL_COST",
        "TOTAL_COST_SUB_PROJECT",
        "DIRECT_COST_AMT",
        "INDIRECT_COST_AMT",
        "ACTIVITY",
      ],
      "query": {
        "bool": {
          "filter": [
            {"term": {"ACTIVITY.keyword": activity_id}},
          ],
          "must_not": [
            {"ids": {"values": [project_id]}},
          ],
        },
      },
      "sort": [{"TOTAL_COST": {"order": "desc"}}],
    },
  )

  peers_hits = peers_response.get("hits", {}).get("hits", [])
  peers_data = []
  for item in peers_hits:
    peer_source = item.get("_source", {})
    peer_title = peer_source.get("PROJECT_TITLE") or f"Project {item.get('_id', '')}"
    peer_cost_value = get_funding_value(peer_source)
    peers_data.append(
      {
        "project_id": item.get("_id"),
        "label": str(peer_title),
        "total_funding": peer_cost_value,
        "is_selected": False,
      },
    )

  data = [
    {
      "project_id": project_id,
      "label": f"Selected: {selected_title}",
      "total_funding": selected_cost_value,
      "is_selected": True,
    },
    *peers_data,
  ]

  return {
    "project_id": project_id,
    "activity_id": activity_id,
    "data": data,
  }


@router.get("/term-tree")
def analytics_term_tree() -> list[dict[str, object]]:
  """Return the 3-level term hierarchy for the TermCloud browser.

  Uses ``tree`` from ``project_term_theme_counts.json`` when present (built from
  ``THEME_TAXONOMY`` in ``indexer/build_project_term_theme_counts.py``). Otherwise
  falls back to the static ``_TERM_HIERARCHY``.
  """
  path = _THEME_COUNTS_PATH
  if path.is_file():
    try:
      payload = json.loads(path.read_text(encoding="utf-8"))
      tree = payload.get("tree")
      if isinstance(tree, list) and tree:
        return tree
    except (OSError, json.JSONDecodeError):
      pass
  return _TERM_HIERARCHY
