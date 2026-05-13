"""Analytics and chart-focused API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .opensearch_client import get_client, get_index_name

router = APIRouter()
INDEX_NAME = get_index_name()


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
  all_ics_agg = {
    "terms": {
      "field": "IC_NAME.keyword",
      "size": 100,
      "order": {"_key": "asc"},
    },
  }

  if fy is None:
    body: dict[str, object] = {"size": 0, "aggs": {"all_ics": all_ics_agg}}
    response = client.search(index=INDEX_NAME, body=body)
    buckets = response.get("aggregations", {}).get("all_ics", {}).get("buckets", [])
    return [{"label": b["key"], "value": b["doc_count"]} for b in buckets]

  body = {
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
  }
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


@router.get("/by-activity")
def analytics_by_activity() -> list[dict[str, object]]:
  client = get_client()
  body = {
    "size": 0,
    "aggs": {
      "by_activity": {
        "terms": {"field": "ACTIVITY.keyword", "size": 30},
        "aggs": {
          "total_funding": {"sum": {"field": "TOTAL_COST"}},
        },
      },
    },
  }
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_activity", {}).get("buckets", [])

  results = [
    {
      "label": b["key"],
      "total_funding": b.get("total_funding", {}).get("value", 0.0),
      "count": b["doc_count"],
    }
    for b in buckets
  ]
  results.sort(key=lambda x: x["total_funding"], reverse=True)
  return results


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
