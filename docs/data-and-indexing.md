# Data and indexing

## Data source

NIH exporter CSV files live under `backend/`:

`2020_data.csv` … `2025_data.csv`

Docker Compose mounts each file read-only into the backend container at `/app/<filename>`.

The default dataset for indexing is **`2025_data.csv`** (override with a CLI argument or `DATA_FILE`).

Each row is one NIH project record. The indexer uses **`APPLICATION_ID`** as the OpenSearch document `_id` so re-runs upsert instead of duplicating.

## Fields the application cares about

The CSV has 46 columns; OpenSearch uses dynamic mapping for most of them. These fields drive search, filters, charts, and embeddings:

| Field | Used for |
| ----- | -------- |
| `APPLICATION_ID` | Unique document id |
| `PROJECT_TITLE` | Search, display, embedding text |
| `PROJECT_TERMS` | Search, embedding text, term analytics |
| `ABSTRACT_TEXT` | Display, embedding text |
| `PI_NAMEs` | Search, filter, investigator page |
| `ORG_NAME`, `ORG_STATE`, `ORG_CITY` | Display, state/org analytics |
| `IC_NAME` | Search, filter, IC charts |
| `ACTIVITY` | Search, filter, activity charts |
| `FY` | Fiscal year filter and time series |
| `TOTAL_COST` | Funding totals (primary) |
| `CORE_PROJECT_NUM` | Linking multiple years of the same award |
| `PROJECT_START`, `PROJECT_END` | Project detail display |

Other CSV columns are stored in the index but not all are shown in the UI.

## Indexing pipeline

```text
CSV file
  → load_data.iter_csv_chunks()     (pandas, 2000 rows per chunk)
  → optional embed_texts()          (--with-embeddings)
  → bulk parallel_bulk()            (OpenSearch, 8 workers)
  → index: project_data
```

**Scripts:**

| Script | Role |
| ------ | ---- |
| `backend/indexer/load_data.py` | Stream CSV rows as dicts |
| `backend/indexer/index_data.py` | Create index, bulk load, optional embeddings |
| `backend/indexer/reindex.py` | Delete index and full rebuild |

### Commands (inside Docker)

First-time load:

```bash
docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

Full rebuild after mapping or model changes:

```bash
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

Verify:

```bash
curl http://localhost:9200/project_data/_count
```

## Embeddings and the vector index

With `--with-embeddings`, `index_data.py`:

1. Creates the index with k-NN enabled on an `embedding` field (384 dimensions, cosine similarity, HNSW).
2. For each record, builds text from title + terms + abstract.
3. Runs `sentence-transformers/all-MiniLM-L6-v2` and stores the vector on the document.

The same model must be used at **index time** and **query time** (`EMBEDDING_MODEL` in `docker-compose.yml`).

Without `--with-embeddings`, keyword search and analytics still work; `/search/similar`, `/search/hybrid`, and the Vector lab need a reindex with embeddings.

## OpenSearch index

| Property | Value |
| -------- | ----- |
| Name | `project_data` |
| Mapping | Dynamic for CSV fields; explicit `embedding` knn_vector when embedded |
| Persistence | Docker volume `opensearch-data` |

During bulk load the indexer temporarily sets `refresh_interval=-1` and `number_of_replicas=0` for speed, then restores normal settings.

## Precomputed analytics file

The dashboard **term theme cloud** does not aggregate live from OpenSearch. It reads:

`backend/indexer/project_term_theme_counts.json`

That JSON is generated offline (see `build_project_term_theme_counts.py` in the indexer folder). The API endpoint `GET /analytics/project-term-theme-cloud` serves this file.

## Related indexer utilities

| File | Purpose |
| ---- | ------- |
| `term_stats.py` | Corpus document frequencies for filtering generic terms at embed time |
| `build_project_term_theme_counts.py` | Builds theme cloud JSON |
| `export_embeddings.py` | Export vectors for analysis |
