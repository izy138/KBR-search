# Semantic and vector search

This project uses **OpenSearch k-NN** (k-nearest neighbors) on dense vectors produced by a **sentence-transformer** model. Semantic search finds grants by *meaning*, not just exact keywords.

## Keyword search vs semantic search

| | Keyword (`GET /search/`) | Semantic (`GET /search/similar`) |
| -- | ------------------------ | --------------------------------- |
| **How it works** | BM25 full-text match on title, terms, PI, org, IC, activity | Embed query text → find nearest document vectors |
| **Good for** | Exact names, grant codes, known phrases | Concepts, related topics, paraphrases |
| **Example** | Query `"R01 cancer immunotherapy"` matches those words | Query `"T cell exhaustion in tumors"` can match related immunology grants without those exact words |
| **Requires embeddings** | No | Yes (index with `--with-embeddings`) |

**Hybrid search** (`GET /search/hybrid`) runs both in parallel and merges rankings with Reciprocal Rank Fusion (RRF).

## End-to-end flow

```text
INDEX TIME (index_data.py --with-embeddings)
────────────────────────────────────────────
CSV row
  → build_text_for_record()     title + filtered PROJECT_TERMS + ABSTRACT_TEXT
  → SentenceTransformer encode  all-MiniLM-L6-v2, 384 dimensions, normalized
  → store on document           field: "embedding"
  → OpenSearch index            knn_vector, HNSW, cosine similarity

QUERY TIME (search.py)
──────────────────────
User query text
  → embed_query()               same model as index time
  → OpenSearch knn query        nearest neighbors in embedding space
  → return top-k documents      embedding stripped from API response
```

The frontend **Vector lab** (`/semantic`) calls these endpoints via `frontend/src/api.ts`.

## What text gets embedded

Implemented in `backend/api/embeddings.py` → `build_text_for_record()`.

**Included fields (in order):**

1. `PROJECT_TITLE`
2. `PROJECT_TERMS` — generic high-frequency terms may be stripped if `term_stats.json` exists
3. `ABSTRACT_TEXT` — truncated to 12,000 characters by default (`EMBEDDING_ABSTRACT_MAX_CHARS`)

**Excluded:** IDs, dollar amounts, dates, org codes, and other administrative fields (they add noise, not semantic signal).

**Model:** `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional vectors, L2-normalized at encode time).

**Important:** The same `EMBEDDING_MODEL` must be used at index time and query time. Vectors from different models cannot be compared. If dimensions mismatch, the API returns **409 Conflict**.

## OpenSearch vector index setup

When you run:

```bash
docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

`backend/indexer/index_data.py` creates the index with:

| Setting | Value |
| ------- | ----- |
| Index setting | `index.knn: true` |
| Field name | `embedding` |
| Field type | `knn_vector` |
| Dimension | 384 |
| Algorithm | HNSW (Hierarchical Navigable Small World) |
| Engine | Lucene |
| Distance | `cosinesimil` (cosine similarity) |

HNSW is an approximate nearest-neighbor graph: fast search over millions of vectors with high recall, without comparing the query to every document.

Each NIH project document stores its vector on the `embedding` property alongside normal CSV fields.

## How a semantic query runs

### Free-text similarity — `GET /search/similar?q=...&k=10`

1. FastAPI loads the sentence-transformer model (lazy, first request pays ~2–3s).
2. `embed_query(q)` converts the query string to a 384-d vector.
3. OpenSearch receives a **knn** query:

```json
{
  "size": 10,
  "query": {
    "knn": {
      "embedding": {
        "vector": [ ...384 floats... ],
        "k": 10
      }
    }
  }
}
```

4. OpenSearch returns the **k** documents whose `embedding` is closest in cosine space.
5. The API removes the raw vector from each hit and attaches `_score` (similarity).

### Similar to an existing project — `GET /search/similar/{project_id}`

1. Load the project by OpenSearch document id.
2. Read its stored `embedding` (no re-embedding).
3. Run k-NN with that vector as the query.
4. Exclude the source project and sibling fiscal-year rows (`CORE_PROJECT_NUM` deduplication).
5. Group results so recurring awards do not dominate the list.

If the project has no `embedding` field, the API returns **409** with a message to reindex with `--with-embeddings`.

## Hybrid search — `GET /search/hybrid`

Hybrid search addresses cases where keywords alone miss relevant grants, or semantics alone miss exact identifiers.

**Steps:**

1. Build shared **filters** (PI, IC, activity, state, fiscal year, etc.) applied to both sides.
2. In parallel (two threads):
   - **BM25** — `multi_match` on `PROJECT_TITLE^4`, `PROJECT_TERMS^2`, `PI_NAMEs^2`, `ORG_NAME`, `IC_NAME`, `ACTIVITY`
   - **k-NN** — embed `q`, search `embedding` with the same filters
3. Each side fetches more than `k` results (`fetch_size = min(k × 4, 100)`) so fusion has candidates.
4. **Reciprocal Rank Fusion (RRF)** merges the two ranked lists:

```text
RRF_score(doc) = Σ  1 / (60 + rank_in_list)
```

Constant `k = 60` (standard from the RRF paper). Raw BM25 and cosine scores are discarded; only **rank position** in each list matters. Documents appearing in both lists score higher.

5. Response includes `_rank_keyword`, `_rank_vector`, and fused `_score` per result.

## Where this appears in the UI

| UI | Route | API |
| -- | ----- | --- |
| Vector lab — semantic | `/semantic` | `GET /search/similar` |
| Vector lab — hybrid | `/semantic` | `GET /search/hybrid` |
| Vector lab — keyword baseline | `/semantic` | `GET /search/` |
| Similar from project | `/semantic/similar/:id` | `GET /search/similar/{id}` |
| Project detail — similar grants | `/projects/:id` | `GET /search/similar/{id}` |

## Configuration

| Variable | Default | Role |
| -------- | ------- | ---- |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Model for index + query |
| `EMBEDDING_DEVICE` | `auto` | `cuda`, `mps`, or `cpu` |
| `EMBEDDING_ABSTRACT_MAX_CHARS` | `12000` | Abstract truncation; `0` = no limit |
| `EMBEDDING_TERM_STATS_PATH` | `term_stats.json` | Optional generic-term filter for `PROJECT_TERMS` |
| `EMBEDDING_TERM_MAX_DF_RATIO` | `0.20` | Terms above this doc frequency are stripped |
| `EMBEDDING_ENCODE_BATCH_SIZE` | `32` | Batch size during indexing |

Set in `docker-compose.yml` for the backend service.

## Enabling semantic search

1. Index **with embeddings**:

```bash
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

2. Confirm the mapping has an `embedding` field:

```bash
curl http://localhost:9200/project_data/_mapping
```

3. Test:

```bash
curl "http://localhost:8000/search/similar?q=CRISPR%20gene%20editing&k=5"
curl "http://localhost:8000/search/hybrid?q=alzheimer%20biomarkers&k=5"
```

4. Open http://localhost:5173/semantic in the browser.

## Key source files

| File | Role |
| ---- | ---- |
| `backend/api/embeddings.py` | Model loading, text building, `embed_query()` |
| `backend/api/search.py` | `/similar`, `/similar/{id}`, `/hybrid`, RRF fusion |
| `backend/indexer/index_data.py` | k-NN mapping, `_attach_embeddings()`, bulk index |
| `frontend/src/components/SemanticVectorLabPage.tsx` | Vector lab UI |
| `frontend/src/components/SemanticSimilarProjectPage.tsx` | Project-based similarity UI |

## Common errors

| HTTP status | Cause | Fix |
| ----------- | ----- | --- |
| **409** | Index has no `embedding` field or wrong vector dimension | Reindex with `--with-embeddings` and matching `EMBEDDING_MODEL` |
| **409** | Single project has no stored vector | That row was indexed without embeddings |
| Empty semantic results | Index empty or model not loaded | Check `_count`, backend logs for model load errors |
