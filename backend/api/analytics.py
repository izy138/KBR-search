"""Analytics and chart-focused API endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from .opensearch_client import get_client, get_index_name

router = APIRouter()
INDEX_NAME = get_index_name()

# Precomputed in `proj_data_analysis.ipynb` (embedding→theme cell): theme masses for dashboard word cloud.
_THEME_COUNTS_PATH = Path(__file__).resolve().parent.parent / "indexer" / "project_term_theme_counts.json"


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
def analytics_summary() -> dict[str, object]:
  client = get_client()
  body = {
    "size": 0,
    "track_total_hits": True,
    "aggs": {
      # Use ACTIVITY as the dashboard category grouping for NIH project data.
      "categories": {"terms": {"field": "ACTIVITY.keyword", "size": 10}},
      "total_funding": {"sum": {"field": "TOTAL_COST"}},
      "unique_ics": {"cardinality": {"field": "IC_NAME.keyword"}},
      "unique_activities": {"cardinality": {"field": "ACTIVITY.keyword"}},
    },
  }
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
def analytics_by_state() -> list[dict[str, object]]:
  client = get_client()
  body = {
    "size": 0,
    "aggs": {
      "by_state": {
        "terms": {"field": "ORG_STATE.keyword", "size": 60},
        "aggs": {
          "total_funding": {"sum": {"field": "TOTAL_COST"}},
        },
      },
    },
  }
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
  fy: int | None = Query(default=None, ge=2000, le=2100, description="Optional fiscal year filter"),
) -> list[dict[str, object]]:
  client = get_client()
  body: dict[str, object] = {
    "size": 0,
    "aggs": {
      "by_ic": {
        "terms": {
          "field": "IC_NAME.keyword",
          "size": 100,
          "order": {"_count": "desc"},
        },
      },
    },
  }
  if fy is not None:
    body["query"] = {"term": {"FY": fy}}
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_ic", {}).get("buckets", [])

  return [{"label": b["key"], "value": b["doc_count"]} for b in buckets]


def _activity_funding_buckets(client: object, *, bucket_size: int) -> tuple[list[dict[str, object]], dict[str, object]]:
  """Return (activity buckets, root aggregations) from a single search."""
  size = max(1, min(bucket_size, 500))
  body = {
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
  }
  response = client.search(index=INDEX_NAME, body=body)
  aggs = response.get("aggregations", {})
  buckets = aggs.get("by_activity", {}).get("buckets", [])
  return buckets, aggs


@router.get("/by-activity")
def analytics_by_activity(
  limit: int = Query(default=50, ge=1, le=200, description="Max activity codes to return"),
) -> list[dict[str, object]]:
  client = get_client()
  buckets, _ = _activity_funding_buckets(client, bucket_size=limit)

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
  buckets, aggs = _activity_funding_buckets(client, bucket_size=limit)
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

  by_activity_meta = aggs.get("by_activity", {})
  sum_other_doc_count = int(by_activity_meta.get("sum_other_doc_count") or 0)

  return {
    "total_funding_indexed": global_total,
    "activity_buckets_fetched": len(rows),
    "pie_slices_cap": pie_slices,
    "merge_other": merge_other,
    "denominator": "total_funding_all" if global_total > 0 else "sum_of_returned_buckets",
    "slices": slices,
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
  return {
    "generated_at": payload.get("generated_at"),
    "method": payload.get("method"),
    "low_confidence_cosine": payload.get("low_confidence_cosine"),
    "buckets": buckets,
    "source_path": str(path.resolve()),
  }


@router.get("/by-year")
def analytics_by_year() -> list[dict[str, object]]:
  client = get_client()
  body = {
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
  }
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
def analytics_top_orgs() -> list[dict[str, object]]:
  client = get_client()
  body = {
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
  }
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
def analytics_avg_grant_by_ic() -> list[dict[str, object]]:
  client = get_client()
  body = {
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
  }
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
