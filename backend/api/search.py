"""Search API endpoints."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
from typing import Any

import re

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import Response

from .embeddings import EMBEDDING_FIELD, embed_query, get_dimension, get_model_name
from .og_export import (
    MAX_EXPORT_ROWS,
    build_export_csv,
    list_og_files,
    load_og_rows,
    normalize_application_id,
    normalize_fy,
    ordered_export_rows,
    resolve_export_columns,
)
from .opensearch_client import get_client, get_index_name
from .query_filters import (
  build_advanced_keyword_must,
  build_keyword_must,
  parse_advanced_q_param,
)

router = APIRouter()

MAX_PROJECT_TERM_FILTERS = 20
MAX_PROJECT_TERM_LENGTH = 200

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

_index_embedding_dimension: int | None = None
logger = logging.getLogger(__name__)


def _require_matching_embedding_dimension(client: Any) -> None:
    """Fail fast when the runtime model does not match the index mapping."""
    global _index_embedding_dimension
    if _index_embedding_dimension is None:
        try:
            mapping = client.indices.get_mapping(index=INDEX_NAME)
            index_block = mapping.get(INDEX_NAME, {})
            properties = index_block.get("mappings", {}).get("properties", {})
            embedding = properties.get(EMBEDDING_FIELD, {})
            dimension = embedding.get("dimension")
            if isinstance(dimension, int):
                _index_embedding_dimension = dimension
        except Exception:
            return

    if _index_embedding_dimension is None:
        return

    model_dimension = get_dimension()
    if model_dimension != _index_embedding_dimension:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Embedding model produces {model_dimension}-d vectors but index "
                f"'{INDEX_NAME}' expects {_index_embedding_dimension}-d. Set "
                f"EMBEDDING_MODEL to the model used at index time (current: "
                f"{get_model_name()})."
            ),
        )


def _normalize_project_terms(raw: list[str]) -> list[str]:
    """Strip terms, dedupe in order, cap to 20 terms, and truncate each to 200 chars."""
    seen: set[str] = set()
    out: list[str] = []
    for t in raw:
        s = t.strip()
        if not s or s in seen:
            continue
        if len(s) > MAX_PROJECT_TERM_LENGTH:
            logger.warning(
                "Truncating project term filter from %d to %d characters",
                len(s),
                MAX_PROJECT_TERM_LENGTH,
            )
            s = s[:MAX_PROJECT_TERM_LENGTH]
        seen.add(s)
        out.append(s)
        if len(out) >= MAX_PROJECT_TERM_FILTERS:
            break
    return out


SORT_FIELD_MAP: dict[str, str] = {
    "PROJECT_TITLE": "PROJECT_TITLE.keyword",
    "PI_NAMEs": "PI_NAMEs.keyword",
    "ORG_NAME": "ORG_NAME.keyword",
    "IC_NAME": "IC_NAME.keyword",
    "ORG_STATE": "ORG_STATE.keyword",
    "ACTIVITY": "ACTIVITY.keyword",
    "FY": "FY",
    "TOTAL_COST": "TOTAL_COST",
}

NUMERIC_SORT_FIELDS = frozenset({"FY", "TOTAL_COST"})


def _must_is_scored(must: list[dict[str, object]]) -> bool:
    if len(must) == 1 and must[0] == {"match_all": {}}:
        return False
    return bool(must)


def _build_search_sort(
    sort_by: str,
    sort_order: str,
    *,
    must: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Map API sort params to OpenSearch sort clauses."""
    normalized_order = "desc" if sort_order.strip().lower() == "desc" else "asc"
    stripped = sort_by.strip()
    if not stripped:
        if _must_is_scored(must):
            return [{"_score": {"order": "desc"}}]
        return []

    os_field = SORT_FIELD_MAP.get(stripped)
    if os_field is None:
        raise HTTPException(status_code=400, detail=f"Unsupported sort_by field: {stripped}")

    unmapped_type = "long" if stripped in NUMERIC_SORT_FIELDS else "keyword"
    return [{os_field: {"order": normalized_order, "unmapped_type": unmapped_type}}]


def _build_search_bool_query(
    *,
    q: str,
    parsed_advanced: tuple[list[dict[str, object]], list[str]] | None,
    normalized_terms: list[str],
    normalized_exclude_terms: list[str],
    category: str,
    pi: str,
    ic: str,
    activity: str,
    state: str,
    fy_min: int | None,
    fy_max: int | None,
) -> tuple[dict[str, object], list[dict[str, object]]]:
    must: list[dict[str, object]] = []
    must_not: list[dict[str, object]] = []
    filters: list[dict[str, object]] = []
    if parsed_advanced is not None:
        adv_clauses, adv_operators = parsed_advanced
        must.extend(build_advanced_keyword_must(adv_clauses, adv_operators))
    elif q:
        must.extend(build_keyword_must(q))
    for term in normalized_terms:
        must.append(
            {"match": {"PROJECT_TERMS": {"query": term, "operator": "and"}}},
        )
    for term in normalized_exclude_terms:
        must_not.append(
            {"match": {"PROJECT_TERMS": {"query": term, "operator": "and"}}},
        )
    if not must:
        must.append({"match_all": {}})
    if category:
        must.append({"term": {"category.keyword": category}})
    if pi:
        filters.append(
            {
                "bool": {
                    "should": [
                        {"match_phrase": {"PI_NAMEs": pi}},
                        {"match": {"PI_NAMEs": {"query": pi, "operator": "and"}}},
                    ],
                    "minimum_should_match": 1,
                },
            },
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
    if len(must) == 1 and not filters and not must_not:
        return must[0], must
    bool_query: dict[str, object] = {"must": must}
    if filters:
        bool_query["filter"] = filters
    if must_not:
        bool_query["must_not"] = must_not
    return {"bool": bool_query}, must


def _collect_search_hits(
    client: Any,
    os_query: dict[str, object],
    *,
    max_rows: int,
    source_includes: list[str] | None = None,
) -> list[dict[str, object]]:
    hits: list[dict[str, object]] = []
    from_ = 0
    page_size = 1_000
    while len(hits) < max_rows:
        size = min(page_size, max_rows - len(hits), MAX_RESULT_WINDOW - from_)
        if size <= 0:
            break
        body: dict[str, object] = {
            "from": from_,
            "size": size,
            "query": os_query,
            "track_total_hits": len(hits) == 0,
        }
        if source_includes is not None:
            body["_source"] = {"includes": source_includes}
        response = client.search(index=INDEX_NAME, body=body)
        batch = response.get("hits", {}).get("hits", [])
        if not batch:
            break
        hits.extend(batch)
        from_ += len(batch)
        if len(batch) < size:
            break
    return hits


def _collect_export_hits(
    client: Any,
    os_query: dict[str, object],
    *,
    max_rows: int,
) -> list[dict[str, object]]:
    """Scroll OpenSearch for APPLICATION_ID + FY keys that match the search."""
    page_size = min(1_000, max_rows)
    body: dict[str, object] = {
        "size": page_size,
        "query": os_query,
        "_source": {"includes": ["APPLICATION_ID", "FY"]},
    }
    response = client.search(index=INDEX_NAME, body=body, scroll="2m")
    scroll_id = response.get("_scroll_id")
    hits: list[dict[str, object]] = list(response.get("hits", {}).get("hits", []))

    try:
        while len(hits) < max_rows and scroll_id:
            response = client.scroll(scroll_id=scroll_id, scroll="2m")
            batch = response.get("hits", {}).get("hits", [])
            if not batch:
                break
            hits.extend(batch)
    finally:
        if scroll_id:
            try:
                client.clear_scroll(scroll_id=scroll_id)
            except Exception:
                pass

    return hits[:max_rows]


def _safe_export_filename(query_label: str) -> str:
    slug = re.sub(r"[^\w\-]+", "-", query_label.strip().lower()).strip("-")
    if not slug:
        slug = "search-results"
    return f"{slug[:60]}.csv"


@router.get("/")
def search(
    q: str = Query(default="", description="Search query"),
    advanced_q: str = Query(
        default="",
        description="JSON advanced query: { clauses: [{text, negated}], operators: [and|or] }",
    ),
    limit: int = Query(default=10, ge=1, le=100),
    page: int = Query(default=1, ge=1, description="1-based page index"),
    category: str = Query(default="", description="Filter by category (category.keyword)"),
    pi: str = Query(default="", description="Filter by PI_NAMEs"),
    ic: str = Query(default="", description="Filter by IC_NAME"),
    activity: str = Query(default="", description="Filter by ACTIVITY"),
    state: str = Query(default="", description="Filter by ORG_STATE"),
    fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
    fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
    project_terms: list[str] = Query(
        default_factory=list,
        description="Each phrase must match PROJECT_TERMS (AND across phrases); repeat param",
    ),
    exclude_project_terms: list[str] = Query(
        default_factory=list,
        description="Exclude projects whose PROJECT_TERMS match each phrase; repeat param",
    ),
    sort_by: str = Query(default="", description="Sort field (e.g. PROJECT_TITLE, FY)"),
    sort_order: str = Query(default="asc", description="asc or desc"),
) -> dict[str, object]:

    client = get_client()
    normalized_terms = _normalize_project_terms(project_terms)
    normalized_exclude_terms = _normalize_project_terms(exclude_project_terms)
    parsed_advanced = parse_advanced_q_param(advanced_q) if advanced_q.strip() else None
    os_query, must = _build_search_bool_query(
        q=q,
        parsed_advanced=parsed_advanced,
        normalized_terms=normalized_terms,
        normalized_exclude_terms=normalized_exclude_terms,
        category=category,
        pi=pi,
        ic=ic,
        activity=activity,
        state=state,
        fy_min=fy_min,
        fy_max=fy_max,
    )
    from_ = (page - 1) * limit
    if from_ >= MAX_RESULT_WINDOW:
        raise HTTPException(
            status_code=400,
            detail=f"Requested page exceeds max result window ({MAX_RESULT_WINDOW}).",
        )
    size = min(limit, MAX_RESULT_WINDOW - from_)
    sort_clause = _build_search_sort(sort_by, sort_order, must=must)
    search_body: dict[str, object] = {
        "from": from_,
        "size": size,
        "query": os_query,
        "track_total_hits": True,
    }
    if sort_clause:
        search_body["sort"] = sort_clause
    response = client.search(index=INDEX_NAME, body=search_body)

    hits = response.get("hits", {}).get("hits", [])
    results = []
    for item in hits:
        source = item.get("_source", {})
        source["_id"] = item.get("_id")
        score = item.get("_score")
        if score is not None:
            source["_score"] = score
        results.append(source)

    total = response.get("hits", {}).get("total", {})
    total_value = total.get("value", 0) if isinstance(total, dict) else total
    visible_total = min(total_value, MAX_RESULT_WINDOW)

    return {
        "query": q,
        "advanced_q": parsed_advanced[0] if parsed_advanced else None,
        "advanced_operators": parsed_advanced[1] if parsed_advanced else None,
        "project_terms": normalized_terms,
        "exclude_project_terms": normalized_exclude_terms,
        "limit": limit,
        "total": total_value,
        "visible_total": visible_total,
        "results": results,
    }


@router.get("/export")
def export_search_csv(
    q: str = Query(default="", description="Search query"),
    advanced_q: str = Query(
        default="",
        description="JSON advanced query: { clauses: [{text, negated}], operators: [and|or] }",
    ),
    category: str = Query(default="", description="Filter by category (category.keyword)"),
    pi: str = Query(default="", description="Filter by PI_NAMEs"),
    ic: str = Query(default="", description="Filter by IC_NAME"),
    activity: str = Query(default="", description="Filter by ACTIVITY"),
    state: str = Query(default="", description="Filter by ORG_STATE"),
    fy_min: int | None = Query(default=None, description="Minimum fiscal year"),
    fy_max: int | None = Query(default=None, description="Maximum fiscal year"),
    project_terms: list[str] = Query(
        default_factory=list,
        description="Each phrase must match PROJECT_TERMS (AND across phrases); repeat param",
    ),
    exclude_project_terms: list[str] = Query(
        default_factory=list,
        description="Exclude projects whose PROJECT_TERMS match each phrase; repeat param",
    ),
    max_rows: int = Query(
        default=MAX_EXPORT_ROWS,
        ge=1,
        le=MAX_EXPORT_ROWS,
        description="Maximum rows to export (capped at OpenSearch result window)",
    ),
) -> Response:
    if not list_og_files():
        raise HTTPException(
            status_code=503,
            detail=(
                "OGdata CSV files not found under backend/indexer/OGdata. "
                "Add files such as 2025_PROJECT.csv before exporting."
            ),
        )

    client = get_client()
    normalized_terms = _normalize_project_terms(project_terms)
    normalized_exclude_terms = _normalize_project_terms(exclude_project_terms)
    parsed_advanced = parse_advanced_q_param(advanced_q) if advanced_q.strip() else None
    os_query, _must = _build_search_bool_query(
        q=q,
        parsed_advanced=parsed_advanced,
        normalized_terms=normalized_terms,
        normalized_exclude_terms=normalized_exclude_terms,
        category=category,
        pi=pi,
        ic=ic,
        activity=activity,
        state=state,
        fy_min=fy_min,
        fy_max=fy_max,
    )

    hits = _collect_export_hits(client, os_query, max_rows=max_rows)
    if not hits:
        raise HTTPException(status_code=404, detail="No results to export for this search.")

    keys: list[tuple[int | None, int | None]] = []
    sample_fy: int | None = None
    for hit in hits:
        source = hit.get("_source", {})
        if not isinstance(source, dict):
            continue
        app_id = normalize_application_id(source.get("APPLICATION_ID"))
        fy = normalize_fy(source.get("FY"))
        if sample_fy is None and fy is not None:
            sample_fy = fy
        keys.append((app_id, fy))

    export_rows = ordered_export_rows(hits, load_og_rows(keys))
    fieldnames = resolve_export_columns(sample_fy)
    if not fieldnames:
        fieldnames = sorted(
            {key for row in export_rows for key in row.keys() if not str(key).startswith("_")},
        )

    csv_text = build_export_csv(export_rows, fieldnames)
    label = q.strip()
    if not label and normalized_terms:
        label = "-".join(normalized_terms[:3])
    if not label and parsed_advanced is not None:
        clauses, _ = parsed_advanced
        label = " ".join(
            str(clause.get("text", "")).strip()
            for clause in clauses
            if str(clause.get("text", "")).strip()
        )
    filename = _safe_export_filename(label)

    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


def _recurrence_core_num(source: dict[str, object]) -> str | None:
    core = source.get("CORE_PROJECT_NUM")
    if isinstance(core, str):
        stripped = core.strip()
        if stripped:
            return stripped
    return None


def _recurrence_title(source: dict[str, object]) -> str | None:
    title = source.get("PROJECT_TITLE")
    if isinstance(title, str):
        stripped = title.strip()
        if stripped:
            return stripped
    return None


def _recurrence_match_query(source: dict[str, object]) -> dict[str, object]:
    """OpenSearch query matching other fiscal years of the same recurring award."""
    core = _recurrence_core_num(source)
    if core:
        return {"term": {"CORE_PROJECT_NUM.keyword": core}}
    title = _recurrence_title(source)
    if title:
        return {"term": {"PROJECT_TITLE.keyword": title}}
    raise HTTPException(
        status_code=400,
        detail="Project has no CORE_PROJECT_NUM or PROJECT_TITLE for recurrence lookup.",
    )


def _search_recurrence_hits(
    client: object,
    query: dict[str, object],
) -> list[dict[str, object]]:
    response = client.search(
        index=INDEX_NAME,
        body={
            "size": 50,
            "query": query,
            "_source": {"includes": ["FY", "APPLICATION_ID", "PROJECT_TITLE", "CORE_PROJECT_NUM"]},
            "sort": [{"FY": {"order": "asc", "unmapped_type": "long"}}],
        },
    )
    hits = response.get("hits", {}).get("hits", [])
    return hits if isinstance(hits, list) else []


def _hits_to_fiscal_years(
    hits: list[dict[str, object]],
    *,
    project_id: str,
) -> list[dict[str, object]]:
    years: list[dict[str, object]] = []
    for hit in hits:
        hit_id = hit.get("_id")
        hit_source = hit.get("_source", {})
        if not isinstance(hit_source, dict):
            continue
        years.append(
            {
                "project_id": hit_id,
                "application_id": hit_source.get("APPLICATION_ID"),
                "fy": hit_source.get("FY"),
                "is_current": hit_id == project_id,
            }
        )
    return years


def _collect_recurrence_years(
    client: object,
    source: dict[str, object],
    *,
    project_id: str,
) -> list[dict[str, object]]:
    """Find sibling fiscal years; fall back to title match when core only finds one year."""
    core = _recurrence_core_num(source)
    title = _recurrence_title(source)
    if not core and not title:
        raise HTTPException(
            status_code=400,
            detail="Project has no CORE_PROJECT_NUM or PROJECT_TITLE for recurrence lookup.",
        )

    merged_hits: list[dict[str, object]] = []
    seen_ids: set[object] = set()

    def absorb(hits: list[dict[str, object]]) -> None:
        for hit in hits:
            hit_id = hit.get("_id")
            if hit_id in seen_ids:
                continue
            seen_ids.add(hit_id)
            merged_hits.append(hit)

    if core:
        absorb(_search_recurrence_hits(client, {"term": {"CORE_PROJECT_NUM.keyword": core}}))

    years = _dedupe_fiscal_years(
        _hits_to_fiscal_years(merged_hits, project_id=project_id),
        current_project_id=project_id,
    )
    if len(years) <= 1 and title:
        absorb(_search_recurrence_hits(client, {"term": {"PROJECT_TITLE.keyword": title}}))
        years = _dedupe_fiscal_years(
            _hits_to_fiscal_years(merged_hits, project_id=project_id),
            current_project_id=project_id,
        )

    return years


def _dedupe_fiscal_years(
    years: list[dict[str, object]],
    *,
    current_project_id: str,
) -> list[dict[str, object]]:
    """Return one row per fiscal year; prefer the document the user is viewing."""
    by_key: dict[object, dict[str, object]] = {}
    for year in years:
        fy = year.get("fy")
        key: object = fy if fy is not None else year.get("project_id")
        if key is None:
            continue
        existing = by_key.get(key)
        if existing is None:
            by_key[key] = year
            continue
        if year.get("project_id") == current_project_id:
            by_key[key] = year
            continue
        if existing.get("project_id") == current_project_id:
            continue
        year_app = year.get("application_id")
        existing_app = existing.get("application_id")
        if isinstance(year_app, int) and isinstance(existing_app, int) and year_app < existing_app:
            by_key[key] = year

    return sorted(
        by_key.values(),
        key=lambda item: (
            item.get("fy") is None,
            item.get("fy") if isinstance(item.get("fy"), (int, float)) else 0,
        ),
    )


def _recurrence_must_not(source: dict[str, object]) -> list[dict[str, object]]:
    """Exclude sibling years of the same recurring award from similarity results."""
    clauses: list[dict[str, object]] = []
    core = _recurrence_core_num(source)
    if core:
        clauses.append({"term": {"CORE_PROJECT_NUM.keyword": core}})
    title = _recurrence_title(source)
    if title:
        clauses.append({"term": {"PROJECT_TITLE.keyword": title}})
    return clauses


def _normalize_core_num(core: str) -> str:
    return " ".join(core.split()).casefold()


def _normalize_recurrence_title(title: str) -> str:
    return " ".join(title.split()).casefold()


def _recurrence_group_key(record: dict[str, object]) -> str:
    """Stable key for deduplicating recurring awards across fiscal years."""
    title = _recurrence_title(record)
    if title:
        return f"title:{_normalize_recurrence_title(title)}"
    core = _recurrence_core_num(record)
    if core:
        return f"core:{_normalize_core_num(core)}"
    record_id = record.get("_id")
    if record_id is not None:
        return f"id:{record_id}"
    return f"row:{id(record)}"


def _append_year_variant(
    variants: list[dict[str, object]],
    variant: dict[str, object],
) -> None:
    """Add a fiscal-year variant unless that FY or project_id is already present."""
    project_id = variant.get("project_id")
    fy = variant.get("fy")
    for existing in variants:
        if project_id is not None and existing.get("project_id") == project_id:
            return
        if fy is not None and existing.get("fy") == fy:
            return
    variants.append(variant)


def _merge_similar_group_into(
    groups: dict[str, dict[str, object]],
    primary_key: str,
    other_key: str,
) -> None:
    """Merge a duplicate recurrence group into the primary group."""
    primary = groups[primary_key]
    other = groups[other_key]
    primary_variants = primary.get("year_variants")
    if not isinstance(primary_variants, list):
        primary_variants = []
    other_variants = other.get("year_variants")
    if isinstance(other_variants, list):
        for variant in other_variants:
            if isinstance(variant, dict):
                _append_year_variant(primary_variants, variant)
    other_score = other.get("_score")
    primary_score = primary.get("_score")
    if isinstance(other_score, (int, float)) and (
        not isinstance(primary_score, (int, float)) or other_score > primary_score
    ):
        preserved_variants = primary_variants
        groups[primary_key] = dict(other)
        groups[primary_key]["year_variants"] = preserved_variants
    else:
        primary["year_variants"] = primary_variants
    del groups[other_key]


def _merge_similar_groups_by_core(
    groups: dict[str, dict[str, object]],
    order: list[str],
) -> tuple[dict[str, dict[str, object]], list[str]]:
    """Merge groups that share the same core project number but different titles."""
    core_index: dict[str, str] = {}
    merged_order: list[str] = []
    for key in order:
        if key not in groups:
            continue
        grouped = groups[key]
        core = _recurrence_core_num(grouped)
        norm_core = _normalize_core_num(core) if core else None
        if norm_core and norm_core in core_index:
            _merge_similar_group_into(groups, core_index[norm_core], key)
            continue
        if norm_core:
            core_index[norm_core] = key
        merged_order.append(key)
    return groups, merged_order


def _group_similar_results(
    results: list[dict[str, object]],
    *,
    limit: int,
) -> list[dict[str, object]]:
    """Collapse recurring fiscal-year rows into one hit with year_variants."""
    groups: dict[str, dict[str, object]] = {}
    order: list[str] = []

    for record in results:
        key = _recurrence_group_key(record)
        variant: dict[str, object] = {
            "project_id": record.get("_id"),
            "application_id": record.get("APPLICATION_ID"),
            "fy": record.get("FY"),
        }

        if key not in groups:
            grouped = dict(record)
            grouped["year_variants"] = [variant]
            groups[key] = grouped
            order.append(key)
            continue

        grouped = groups[key]
        variants = grouped.get("year_variants")
        if not isinstance(variants, list):
            variants = []
        if variant.get("project_id") not in {
            item.get("project_id")
            for item in variants
            if isinstance(item, dict) and item.get("project_id") is not None
        }:
            _append_year_variant(variants, variant)
        grouped["year_variants"] = variants

        record_score = record.get("_score")
        group_score = grouped.get("_score")
        if isinstance(record_score, (int, float)) and (
            not isinstance(group_score, (int, float)) or record_score > group_score
        ):
            preserved_variants = grouped["year_variants"]
            groups[key] = dict(record)
            groups[key]["year_variants"] = preserved_variants

    groups, order = _merge_similar_groups_by_core(groups, order)

    grouped_results: list[dict[str, object]] = []
    for key in order[:limit]:
        grouped = groups[key]
        variants = grouped.get("year_variants")
        if isinstance(variants, list):
            grouped["year_variants"] = sorted(
                variants,
                key=lambda item: (
                    not isinstance(item, dict) or item.get("fy") is None,
                    item.get("fy") if isinstance(item, dict) else 0,
                ),
            )
        grouped_results.append(grouped)
    return grouped_results


@router.get("/project/{project_id}/other-years")
def get_project_other_years(
    project_id: str = Path(..., description="OpenSearch document ID"),
) -> dict[str, object]:
    """Return other fiscal-year records for the same recurring NIH project."""
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
    if not isinstance(source, dict):
        source = {}

    years = _collect_recurrence_years(client, source, project_id=project_id)

    return {
        "project_id": project_id,
        "project_title": _recurrence_title(source),
        "core_project_num": _recurrence_core_num(source),
        "years": years,
        "other_years": [year for year in years if not year.get("is_current")],
    }


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
    _require_matching_embedding_dimension(client)
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
    _require_matching_embedding_dimension(client)
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

    knn_clause: dict[str, object] = {"vector": vector, "k": k + 1}
    if isinstance(source, dict):
        must_not = _recurrence_must_not(source)
        if must_not:
            knn_clause["filter"] = {"bool": {"must_not": must_not}}

    # Over-fetch so we can return k unique recurring projects after year deduplication.
    fetch_k = min(SIMILAR_MAX_K, max(k * 4, k + 15))
    knn_clause["k"] = fetch_k + 1

    response = client.search(
        index=INDEX_NAME,
        body={
            "size": fetch_k + 1,
            "_source": {"excludes": [EMBEDDING_FIELD]},
            "query": {"knn": {EMBEDDING_FIELD: knn_clause}},
        },
    )
    hits = response.get("hits", {}).get("hits", [])
    formatted = _format_knn_hits(hits, exclude_id=project_id)
    return {
        "project_id": project_id,
        "k": k,
        "results": _group_similar_results(formatted, limit=k),
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
    _require_matching_embedding_dimension(client)

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
