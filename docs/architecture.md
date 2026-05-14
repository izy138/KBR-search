# Architecture

This app has three runtime services. The browser never talks to OpenSearch directly.

## System diagram

```text
┌─────────────────┐     HTTP (JSON)      ┌─────────────────┐     opensearch-py     ┌─────────────────┐
│  React frontend │ ───────────────────► │  FastAPI backend │ ────────────────────► │   OpenSearch    │
│  localhost:5173 │ ◄─────────────────── │  localhost:8000  │ ◄──────────────────── │  localhost:9200 │
└─────────────────┘                      └─────────────────┘                       └─────────────────┘
                                                ▲
                                                │ bulk index (one-time / reindex)
                                         ┌──────┴──────┐
                                         │ CSV indexer │
                                         │ index_data  │
                                         └─────────────┘
```

## Service roles

| Service | Code | Responsibility |
| ------- | ---- | -------------- |
| **Frontend** | `frontend/src/` | UI: search, dashboard charts, project pages, vector lab |
| **Backend** | `backend/api/` | REST API, query building, embedding queries at search time |
| **OpenSearch** | Docker image | Stores NIH project documents and optional 384-d vectors |
| **Indexer** | `backend/indexer/` | Reads CSV, optionally embeds text, bulk-writes to OpenSearch |

## Request path (example: dashboard state map)

1. User opens the Dashboard tab in the React app.
2. `Dashboard.tsx` calls `getStateData()` in `frontend/src/api.ts`.
3. That hits `GET /analytics/by-state` on FastAPI.
4. `analytics.py` runs an OpenSearch aggregation on `ORG_STATE.keyword` and sums `TOTAL_COST`.
5. JSON buckets return to the frontend; `StateMap.tsx` colors states from that data.

## Request path (example: keyword search)

1. User types a query and submits the search form.
2. `App.tsx` calls `searchProjects()` with filters (`pi`, `ic`, `activity`, `state`, fiscal year).
3. FastAPI `GET /search/` builds a BM25 query over title, terms, PI, org, IC, and activity fields.
4. OpenSearch returns matching documents; the results list renders them.

## Request path (example: semantic / hybrid search)

1. User opens **Vector lab** (`/semantic`) and runs a similarity or hybrid search.
2. FastAPI embeds the query text with the same model used at index time (`all-MiniLM-L6-v2`, 384 dimensions).
3. **Similar:** k-NN search on the `embedding` field.
4. **Hybrid:** BM25 and k-NN run in parallel; results are merged with Reciprocal Rank Fusion (RRF).

If the live model dimension does not match the index mapping, the API returns **409**.

## Docker networking

Inside Compose, the backend uses `OPENSEARCH_HOST=opensearch` (the service name). On the host machine you use `localhost` for all three ports.

| From | To | URL |
| ---- | -- | --- |
| Browser | Frontend | http://localhost:5173 |
| Browser | Backend | http://localhost:8000 |
| Backend container | OpenSearch | http://opensearch:9200 |
| Developer | OpenSearch | http://localhost:9200 |

CORS on the API allows `http://localhost:5173` only (`backend/api/main.py`).

## Key files

| Path | Purpose |
| ---- | ------- |
| `docker-compose.yml` | Starts OpenSearch, backend, frontend |
| `frontend/src/App.tsx` | Routes and main search view |
| `frontend/src/api.ts` | Typed HTTP client for all backend calls |
| `backend/api/main.py` | FastAPI app, router mount, health check |
| `backend/api/search.py` | Search, similar, hybrid, investigator routes |
| `backend/api/analytics.py` | Dashboard aggregation endpoints |
| `backend/api/opensearch_client.py` | OpenSearch connection factory |
| `backend/api/embeddings.py` | Query-time embedding model |
| `backend/indexer/index_data.py` | CSV → bulk index pipeline |
| `backend/indexer/reindex.py` | Delete index and rebuild |
