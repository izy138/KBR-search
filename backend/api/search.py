"""Search API endpoints."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, HTTPException, Path, Query

from .embeddings import EMBEDDING_FIELD, embed_query
from .opensearch_client import get_client, get_index_name

router = APIRouter()
INDEX_NAME = get_index_name()
MAX_RESULT_WINDOW = 10_000
SEARCH_FIELDS = [
    "PROJECT_TITLE^4",
    "PROJECT_TERMS^2",
    "PI_NAMEs^2",
    "ORG_NAME",
    "IC_NAME",
    "ACTIVITY",
]
SIMILAR_DEFAULT_K = 10
SIMILAR_MAX_K = 50
HYBRID_DEFAULT_K = 10
HYBRID_MAX_K = 50
RRF_K_CONST = 60  # Standard smoothing constant from the original RRF paper.
HYBRID_FETCH_MULTIPLIER = 4  # Pull this many * k from each side before fusing.
HYBRID_MAX_FETCH = 100


@router.get("/")
def search(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=10, ge=1, le=100),
    page: int = Query(default=1, ge=1, description="1-based page index"),
    category: str = Query(default="", description="Filter by category (category.keyword)"),
    pi: str = Query(default="", description="Filter by PI_NAMEs"),
    ic: str = Query(default="", description="Filter by IC_NAME"),
    activity: str = Query(default="", description="Filter by ACTIVITY"),
    state: str = Query(default="", description="Filter by ORG_STATE"),
    fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
    fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
) -> dict[str, object]:
    client = get_client()
    must: list[dict[str, object]] = []
    filters: list[dict[str, object]] = []
    if q:
        must.append(
            {
                "multi_match": {
                    "query": q,
                    "fields": SEARCH_FIELDS,
                    "type": "best_fields",
                    "operator": "and",
                }
            }
        )
    else:
        must.append({"match_all": {}})
    if category:
        must.append({"term": {"category.keyword": category}})
    if pi:
        # Support both "Last, First" and "First Last" user inputs.
        # `match` with operator "and" keeps all terms required but does not
        # force token order, while `match_phrase` preserves exact phrase behavior.
        filters.append(
            {
                "bool": {
                    "should": [
                        {"match_phrase": {"PI_NAMEs": pi}},
                        {"match": {"PI_NAMEs": {"query": pi, "operator": "and"}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        )
    if ic:
        filters.append({"term": {"IC_NAME.keyword": ic}})
    if activity:
        filters.append({"term": {"ACTIVITY.keyword": activity}})
    if state:
        filters.append({"term": {"ORG_STATE.keyword": state}})
    if fy_min is not None or fy_max is not None:
        range_clause: dict[str, int] = {}
        if fy_min is not None:
            range_clause["gte"] = fy_min
        if fy_max is not None:
            range_clause["lte"] = fy_max
        filters.append({"range": {"FY": range_clause}})
    if len(must) == 1 and not filters:
        os_query: dict[str, object] = must[0]
    else:
        bool_query: dict[str, object] = {"must": must}
        if filters:
            bool_query["filter"] = filters
        os_query = {"bool": bool_query}
    from_ = (page - 1) * limit
    if from_ >= MAX_RESULT_WINDOW:
        raise HTTPException(
            status_code=400,
            detail=f"Requested page exceeds max result window ({MAX_RESULT_WINDOW}).",
        )
    size = min(limit, MAX_RESULT_WINDOW - from_)
    response = client.search(
        index=INDEX_NAME,
        body={"from": from_, "size": size, "query": os_query, "track_total_hits": True},
    )

    hits = response.get("hits", {}).get("hits", [])
    results = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total
    visible_total = min(total_value, MAX_RESULT_WINDOW)

    return {
        "query": q,
        "limit": limit,
        "total": total_value,
        "visible_total": visible_total,
        "results": results,
    }


@router.get("/project/{project_id}")
def get_project(project_id: str = Path(..., description="OpenSearch document ID")) -> dict[str, object]:
    client = get_client()
    try:
        response = client.get(index=INDEX_NAME, id=project_id)
    except Exception as exc:
        error_body = getattr(exc, "info", {})
        status_code = error_body.get("status") if isinstance(error_body, dict) else None
        if status_code == 404:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise

    source = response.get("_source", {})
    source["_id"] = response.get("_id")
    return {"project": source}


def _format_knn_hits(
    hits: list[dict[str, object]],
    *,
    exclude_id: str | None = None,
) -> list[dict[str, object]]:
    """Strip the embedding vector from each hit and attach the relevance score."""
    results: list[dict[str, object]] = []
    for item in hits:
        if exclude_id is not None and item.get("_id") == exclude_id:
            continue
        source = item.get("_source", {})
        if isinstance(source, dict):
            source.pop(EMBEDDING_FIELD, None)
            source["_id"] = item.get("_id")
            source["_score"] = item.get("_score")
            results.append(source)
    return results


@router.get("/similar")
def search_similar(
    q: str = Query(..., min_length=1, description="Free-text query to embed"),
    k: int = Query(default=SIMILAR_DEFAULT_K, ge=1, le=SIMILAR_MAX_K),
) -> dict[str, object]:
    """Semantic search: find projects whose embedding is closest to the query."""
    client = get_client()
    query_vector = embed_query(q)
    response = client.search(
        index=INDEX_NAME,
        body={
            "size": k,
            "_source": {"excludes": [EMBEDDING_FIELD]},
            "query": {"knn": {EMBEDDING_FIELD: {"vector": query_vector, "k": k}}},
        },
    )
    hits = response.get("hits", {}).get("hits", [])
    return {"query": q, "k": k, "results": _format_knn_hits(hits)}


@router.get("/similar/{project_id}")
def search_similar_to_project(
    project_id: str = Path(..., description="OpenSearch document ID"),
    k: int = Query(default=SIMILAR_DEFAULT_K, ge=1, le=SIMILAR_MAX_K),
) -> dict[str, object]:
    """Find projects semantically similar to an existing project.

    Looks up the source document, reuses its stored embedding, and returns the
    top-k nearest neighbours (excluding the source document itself).
    """
    client = get_client()
    try:
        source_doc = client.get(index=INDEX_NAME, id=project_id)
    except Exception as exc:
        error_body = getattr(exc, "info", {})
        status_code = error_body.get("status") if isinstance(error_body, dict) else None
        if status_code == 404:
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise

    source = source_doc.get("_source", {})
    vector = source.get(EMBEDDING_FIELD) if isinstance(source, dict) else None
    if not vector:
        raise HTTPException(
            status_code=409,
            detail=(
                "This project has no embedding. Reindex with --with-embeddings to "
                "enable similarity search."
            ),
        )

    response = client.search(
        index=INDEX_NAME,
        body={
            # Request k+1 so we still return k results after removing the source.
            "size": k + 1,
            "_source": {"excludes": [EMBEDDING_FIELD]},
            "query": {"knn": {EMBEDDING_FIELD: {"vector": vector, "k": k + 1}}},
        },
    )
    hits = response.get("hits", {}).get("hits", [])
    return {
        "project_id": project_id,
        "k": k,
        "results": _format_knn_hits(hits, exclude_id=project_id)[:k],
    }


@router.get("/investigator/{pi_name}")
def get_projects_for_investigator(
    pi_name: str = Path(..., description="Principal investigator name"),
    limit: int = Query(default=25, ge=1, le=100),
    page: int = Query(default=1, ge=1, description="1-based page index"),
) -> dict[str, object]:
    client = get_client()
    from_ = (page - 1) * limit
    if from_ >= MAX_RESULT_WINDOW:
        raise HTTPException(
            status_code=400,
            detail=f"Requested page exceeds max result window ({MAX_RESULT_WINDOW}).",
        )
    size = min(limit, MAX_RESULT_WINDOW - from_)
    response = client.search(
        index=INDEX_NAME,
        body={
            "from": from_,
            "size": size,
            "track_total_hits": True,
            "sort": [{"FY": {"order": "desc"}}],
            "query": {
                "bool": {
                    "should": [
                        {"term": {"PI_NAMEs.keyword": pi_name}},
                        {"match_phrase": {"PI_NAMEs": pi_name}},
                        {"match": {"PI_NAMEs": {"query": pi_name, "operator": "and"}}},
                    ],
                    "minimum_should_match": 1,
                }
            },
        },
    )

    hits = response.get("hits", {}).get("hits", [])
    results: list[dict[str, object]] = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total
    visible_total = min(total_value, MAX_RESULT_WINDOW)
    return {
        "investigator_name": pi_name,
        "limit": limit,
        "total": total_value,
        "visible_total": visible_total,
        "results": results,
    }


def _build_hybrid_filters(
    *,
    category: str,
    pi: str,
    ic: str,
    activity: str,
    state: str,
    fy_min: int | None,
    fy_max: int | None,
) -> list[dict[str, Any]]:
    """Build the shared filter clauses applied to both BM25 and k-NN sides.

    These are non-scoring filters (term/range), so they shrink the candidate set
    identically for both searches and don't interfere with relevance scoring.
    """
    filters: list[dict[str, Any]] = []
    if category:
        filters.append({"term": {"category.keyword": category}})
    if pi:
        filters.append(
            {
                "bool": {
                    "should": [
                        {"match_phrase": {"PI_NAMEs": pi}},
                        {"match": {"PI_NAMEs": {"query": pi, "operator": "and"}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        )
    if ic:
        filters.append({"term": {"IC_NAME.keyword": ic}})
    if activity:
        filters.append({"term": {"ACTIVITY.keyword": activity}})
    if state:
        filters.append({"term": {"ORG_STATE.keyword": state}})
    if fy_min is not None or fy_max is not None:
        range_clause: dict[str, int] = {}
        if fy_min is not None:
            range_clause["gte"] = fy_min
        if fy_max is not None:
            range_clause["lte"] = fy_max
        filters.append({"range": {"FY": range_clause}})
    return filters


def _rrf_fuse(
    keyword_hits: list[dict[str, Any]],
    vector_hits: list[dict[str, Any]],
    *,
    top_k: int,
    k_const: int = RRF_K_CONST,
) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion over the two ranked result lists.

    Each document's fused score is the sum of 1 / (k_const + rank) for each list
    it appears in. Documents absent from a list contribute 0 from that side.
    Raw BM25 / cosine scores are intentionally discarded — only the rank order
    of each list matters, which sidesteps the score-calibration problem.
    """
    scores: dict[str, float] = {}
    by_id: dict[str, dict[str, Any]] = {}
    keyword_rank: dict[str, int] = {}
    vector_rank: dict[str, int] = {}

    for rank, item in enumerate(keyword_hits, start=1):
        doc_id = item.get("_id")
        if doc_id is None:
            continue
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k_const + rank)
        by_id.setdefault(doc_id, item)
        keyword_rank[doc_id] = rank

    for rank, item in enumerate(vector_hits, start=1):
        doc_id = item.get("_id")
        if doc_id is None:
            continue
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k_const + rank)
        by_id.setdefault(doc_id, item)
        vector_rank[doc_id] = rank

    sorted_ids = sorted(scores, key=lambda d: scores[d], reverse=True)[:top_k]

    fused: list[dict[str, Any]] = []
    for doc_id in sorted_ids:
        source_item = by_id[doc_id]
        source = source_item.get("_source", {})
        if not isinstance(source, dict):
            continue
        source.pop(EMBEDDING_FIELD, None)
        source["_id"] = doc_id
        source["_score"] = round(scores[doc_id], 6)
        source["_rank_keyword"] = keyword_rank.get(doc_id)
        source["_rank_vector"] = vector_rank.get(doc_id)
        fused.append(source)
    return fused


@router.get("/hybrid")
def search_hybrid(
    q: str = Query(..., min_length=1, description="Free-text query"),
    k: int = Query(default=HYBRID_DEFAULT_K, ge=1, le=HYBRID_MAX_K),
    category: str = Query(default=""),
    pi: str = Query(default=""),
    ic: str = Query(default=""),
    activity: str = Query(default=""),
    state: str = Query(default=""),
    fy_min: int | None = Query(default=None),
    fy_max: int | None = Query(default=None),
) -> dict[str, object]:
    """Hybrid keyword + semantic search fused with Reciprocal Rank Fusion.

    Runs a BM25 search and a k-NN search in parallel against the same set of
    filters, then merges their rankings. Returns the top-k documents by RRF
    score, each annotated with its rank in the individual lists for
    transparency.
    """
    client = get_client()

    filters = _build_hybrid_filters(
        category=category,
        pi=pi,
        ic=ic,
        activity=activity,
        state=state,
        fy_min=fy_min,
        fy_max=fy_max,
    )

    # Over-fetch from each side so RRF has enough candidates to work with;
    # the fused top-k might not be in the top-k of either individual list.
    fetch_size = min(max(k * HYBRID_FETCH_MULTIPLIER, 25), HYBRID_MAX_FETCH)

    bm25_must: dict[str, Any] = {
        "multi_match": {
            "query": q,
            "fields": SEARCH_FIELDS,
            "type": "best_fields",
            "operator": "and",
        }
    }
    bm25_query: dict[str, Any]
    if filters:
        bm25_query = {"bool": {"must": [bm25_must], "filter": filters}}
    else:
        bm25_query = bm25_must
    bm25_body: dict[str, Any] = {
        "from": 0,
        "size": fetch_size,
        "_source": {"excludes": [EMBEDDING_FIELD]},
        "query": bm25_query,
    }

    # Kick off BM25 in a worker so embedding the query runs in parallel.
    with ThreadPoolExecutor(max_workers=2) as executor:
        bm25_future = executor.submit(client.search, index=INDEX_NAME, body=bm25_body)

        query_vector = embed_query(q)

        knn_clause: dict[str, Any] = {"vector": query_vector, "k": fetch_size}
        if filters:
            knn_clause["filter"] = {"bool": {"filter": filters}}
        knn_body: dict[str, Any] = {
            "size": fetch_size,
            "_source": {"excludes": [EMBEDDING_FIELD]},
            "query": {"knn": {EMBEDDING_FIELD: knn_clause}},
        }
        knn_future = executor.submit(client.search, index=INDEX_NAME, body=knn_body)

        bm25_response = bm25_future.result()
        knn_response = knn_future.result()

    keyword_hits = bm25_response.get("hits", {}).get("hits", [])
    vector_hits = knn_response.get("hits", {}).get("hits", [])
    fused = _rrf_fuse(keyword_hits, vector_hits, top_k=k)

    keyword_total_raw = bm25_response.get("hits", {}).get("total", {})
    if isinstance(keyword_total_raw, dict):
        keyword_total = keyword_total_raw.get("value", 0)
    else:
        keyword_total = keyword_total_raw

    return {
        "query": q,
        "k": k,
        "keyword_total": keyword_total,
        "keyword_returned": len(keyword_hits),
        "vector_returned": len(vector_hits),
        "fetch_size_per_side": fetch_size,
        "results": fused,
    }
