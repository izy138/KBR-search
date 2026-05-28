# KBR Internship — NIH Research Grant Search & Analytics

A full-stack application for searching and analyzing NIH research grant data (2020–2025). Built on OpenSearch for keyword, vector, and hybrid search, with a React dashboard for funding analytics.

---

## Quick Start

### Requirements

| Tool | Minimum Version |
|------|----------------|
| Docker Desktop | 4.x (Engine 20+) |
| Docker Compose | v2 (included with Docker Desktop) |
| Node.js | 18+ (for local frontend dev only) |
| Python | 3.12+ (for local backend dev only) |

> OpenSearch requires at least **4 GB** of memory allocated to Docker Desktop. Set this under Settings → Resources → Memory before running `docker compose up`.

### First run

```bash
# 1. Clone and start all services
git clone <repo-url>
cd KBR-Internship
docker compose up --build
```

Wait for all three containers to report healthy, then load data:

```bash
# First-time index (idempotent — safe to run if index already exists)
docker compose exec backend python indexer/index_data.py /app/2025_data.csv

# Wipe and rebuild with embeddings (use after mapping changes or corruption)
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

Verify the index:

```bash
curl http://localhost:9200/project_data/_count
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| OpenSearch | http://localhost:9200 |

---

## Project Structure

```
KBR-Internship/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI entrypoint, CORS, router mounting
│   │   ├── opensearch_client.py # Client factory (reads env vars)
│   │   ├── search.py            # /search/ endpoints (keyword, vector, hybrid)
│   │   ├── analytics.py         # /analytics/ endpoints
│   │   ├── embeddings.py        # Lazy-loaded sentence-transformers singleton
│   │   └── query_filters.py     # Filter parameter parsing utilities
│   ├── indexer/
│   │   ├── load_data.py         # CSV → list[dict]
│   │   ├── index_data.py        # Bulk index into OpenSearch
│   │   └── reindex.py           # Wipe + rebuild index (one command)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── api.ts               # Typed fetch helpers + response interfaces
│       ├── App.tsx              # Root component, routing, layout shell
│       ├── hooks/               # Custom hooks (search, filters, pagination, theme)
│       ├── utils/               # Formatting, styling constants, class utilities
│       └── components/
│           ├── search/          # Keyword search view
│           ├── dashboard/       # Analytics dashboard
│           ├── charts/          # Reusable chart panels
│           ├── project/         # Single project detail view
│           ├── investigator/    # Investigator projects view
│           ├── semantic/        # Vector lab views
│           └── shared/          # Cross-cutting components (ErrorBoundary, Pagination)
├── docs/                        # Architecture and user documentation
├── docker-compose.yml
└── .env.example
```

---

## Backend

**Stack:** Python 3.12, FastAPI 0.136, Uvicorn, opensearch-py 3.2, sentence-transformers 5.4, PyTorch 2.6

The backend is a FastAPI application with two route modules mounted in `main.py`:

- `search.py` — keyword (`multi_match`), k-NN vector, and hybrid (BM25 + k-NN) search
- `analytics.py` — aggregation-based analytics; never fetches full documents for summary queries

The OpenSearch client is always obtained from `api/opensearch_client.py`. It is never instantiated inline in route handlers.

Embeddings use a lazy-loaded singleton in `embeddings.py` backed by `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions). The model is downloaded on first use and cached in a Docker volume.

---

## API Overview

### Health

```
GET /health
```

Returns `{ "status": "ok", "opensearch": "up" }`. Verifies both FastAPI liveness and OpenSearch reachability.

### Search

| Endpoint | Description |
|----------|-------------|
| `GET /search/` | Keyword search with filters and pagination |
| `GET /search/project/{id}` | Single project by document ID |
| `GET /search/project/{id}/other-years` | Fiscal year variants for a project |
| `GET /search/investigator/{name}` | Projects by PI name |
| `GET /search/similar?q=<str>&k=<int>` | k-NN vector search by text |
| `GET /search/similar/{id}?k=<int>` | k-NN similar to an existing project |
| `GET /search/hybrid?q=<str>&k=<int>` | BM25 + k-NN fused search |

Keyword search parameters: `q`, `limit` (1–100), `page`, `pi`, `ic`, `activity`, `state`, `fy_min`, `fy_max`, `project_terms`.

### Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /analytics/summary` | Total documents, funding, unique ICs/activities |
| `GET /analytics/by-state` | Project count and funding per state |
| `GET /analytics/by-ic` | Project count per institute/center |
| `GET /analytics/by-activity` | Activity codes with funding |
| `GET /analytics/by-activity-funding-pie` | Pie chart data |
| `GET /analytics/by-year` | Year-over-year trends |
| `GET /analytics/top-orgs` | Top organizations by funding |
| `GET /analytics/avg-grant-by-ic` | Average grant size per IC |
| `GET /analytics/project-term-theme-cloud` | Term frequency word cloud |
| `GET /analytics/term-tree` | Hierarchical term structure |
| `GET /analytics/by-activity-terms` | Terms for an activity |
| `GET /analytics/by-activity-project-compare` | Compare a project to its peers |

All analytics endpoints accept optional filter parameters: `pi`, `ic`, `activity`, `state`, `fy_min`, `fy_max`.

---

## Frontend

**Stack:** React 18, TypeScript 5.9, Vite 7, Tailwind CSS, Recharts

All API calls are made through typed fetch helpers in `src/api.ts` using the `VITE_API_BASE_URL` constant (defaults to `http://localhost:8000`). Response shapes are defined as TypeScript interfaces in that file — no `any`, no index signatures.

State and side-effects live in custom hooks under `src/hooks/`. Components are responsible for rendering only. Routes are URL-driven: `/` renders the search view, `/dashboard` renders the analytics dashboard. Heavy route components are lazy-loaded via `React.lazy()` + `<Suspense>`.

To type-check without building:

```bash
cd frontend && npx tsc --noEmit
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_HOST` | `localhost` | `opensearch` inside Docker (service name); `localhost` outside |
| `OPENSEARCH_PORT` | `9200` | OpenSearch HTTP port |
| `OPENSEARCH_INDEX` | `project_data` | Target index name |
| `DATA_FILE` | `2025_data.csv` | Path to data file (relative to working directory) |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Sentence-transformers model (384-d) |
| `EMBEDDING_DEVICE` | `auto` | `auto`, `cpu`, `cuda`, or `mps` |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend → backend base URL |

For local development outside Docker, copy `.env.example` to `.env` in `backend/`.

---

## Development Notes

### PyTorch and GPU acceleration

The default Docker image uses the CPU build of PyTorch. To enable GPU encoding:

- **NVIDIA:** Install a CUDA-capable `torch` build per the [PyTorch install guide](https://pytorch.org/get-started/locally/) and set `EMBEDDING_DEVICE=cuda`.
- **Apple Silicon:** Set `EMBEDDING_DEVICE=mps` — works outside Docker (MPS is not available inside Linux containers).

### Embedding model consistency

Indexed vectors are 384-dimensional (`all-MiniLM-L6-v2`). Query-time embeddings must use the same model. Switching to a different model (e.g., `all-mpnet-base-v2` at 768-d) requires a full reindex:

```bash
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

### Index idempotency

`index_data.py` checks for an existing index before creating one. Running it against an already-indexed dataset is safe and will not create duplicates. Use `reindex.py` when you need a clean rebuild.

### k-NN search

k-NN queries require the `embedding` field to be populated. If you indexed without `--with-embeddings`, the `/search/similar` and `/search/hybrid` endpoints will return no results. Reindex with embeddings to enable vector search.

### Docker vs. local development

Inside Docker, `OPENSEARCH_HOST` is set to `opensearch` (the Compose service name) automatically. Outside Docker, it must be `localhost`. The `.env.example` file reflects the outside-Docker defaults.

### Tests

```bash
docker compose exec backend pytest
```

Tests require the backend container to be running and OpenSearch to be reachable.

### API documentation

Interactive Swagger UI is available at http://localhost:8000/docs while the backend container is running.
