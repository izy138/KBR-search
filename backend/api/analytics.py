"""Analytics and chart-focused API endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from .opensearch_client import get_client, get_index_name

router = APIRouter()
INDEX_NAME = get_index_name()


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
def analytics_by_ic() -> list[dict[str, object]]:
  client = get_client()
  body = {
    "size": 0,
    "aggs": {
      "by_ic": {
        "terms": {
          "field": "IC_NAME.keyword",
          "size": 40,
          "order": {"_count": "desc"},
        },
      },
    },
  }
  response = client.search(index=INDEX_NAME, body=body)
  buckets = response.get("aggregations", {}).get("by_ic", {}).get("buckets", [])

  return [{"label": b["key"], "value": b["doc_count"]} for b in buckets]


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
          "size": 30,
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
