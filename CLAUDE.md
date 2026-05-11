# KBR Internship — Project Ground Truth

## Stack

| Layer | Technology | Local Port |
|-------|-----------|-----------|
| Frontend | React 19 + TypeScript + Vite | 5173 |
| Backend | Python 3.12 + FastAPI | 8000 |
| Search | OpenSearch 2.14.0 | 9200 |
| Orchestration | Docker Compose | — |

## Repo Structure

```
KBR-Internship/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI entrypoint, CORS, router mounting
│   │   ├── opensearch_client.py # Client factory (reads env vars)
│   │   ├── search.py            # GET /search/
│   │   └── analytics.py         # GET /analytics/summary
│   ├── indexer/
│   │   ├── load_data.py         # CSV → list[dict]
│   │   ├── index_data.py        # Bulk index into OpenSearch
│   │   └── reindex.py           # Wipe + rebuild index (one command)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── api.ts               # Typed fetch helpers + response interfaces
│       ├── App.tsx              # Root component + state
│       ├── main.tsx
│       ├── styles.css
│       └── components/
│           ├── SearchBar.tsx
│           ├── ResultsList.tsx
│           ├── Filters.tsx
│           └── Charts.tsx
├── docker-compose.yml
├── .env.example                 # Template for running backend outside Docker
└── backend/2020_data.csv … 2025_data.csv   # Yearly NIH exports (mounted at /app/)
```

## Running Locally

```bash
# 1. Start all three services
docker compose up --build

# 2a. First-time load (skip if already indexed)
docker compose exec backend python indexer/index_data.py /app/2025_data.csv

# 2b. Wipe and rebuild (mapping change, corrupt index, fresh start)
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

Verify data loaded:
```bash
curl http://localhost:9200/project_data/_count
```

## OpenSearch Index

- **Index name:** `project_data`
- **Mapping:** dynamic (OpenSearch infers types from CSV values)
- **Data source:** `2020_data.csv` … `2025_data.csv` in `backend/` — each mounted read-only at `/app/<name>` inside the backend container. Default indexer path is `2025_data.csv` (override with CLI arg or `DATA_FILE`).

### CSV Fields (46 columns)

```
APPLICATION_ID    ACTIVITY          ADMINISTERING_IC  APPLICATION_TYPE
ARRA_FUNDED       AWARD_NOTICE_DATE  BUDGET_START      BUDGET_END
ASSISTANCE_LISTING_NUMBER           CORE_PROJECT_NUM  ED_INST_TYPE
OPPORTUNITY_NUMBER                  FULL_PROJECT_NUM  FUNDING_ICs
FUNDING_MECHANISM FY                IC_NAME           NIH_SPENDING_CATS
ORG_CITY          ORG_COUNTRY       ORG_DEPT          ORG_DISTRICT
ORG_DUNS          ORG_FIPS          ORG_IPF_CODE      ORG_NAME
ORG_STATE         ORG_ZIPCODE       PHR               PI_IDS
PI_NAMEs          PROGRAM_OFFICER_NAME                PROJECT_START
PROJECT_END       PROJECT_TERMS     PROJECT_TITLE     SERIAL_NUMBER
STUDY_SECTION     STUDY_SECTION_NAME                  SUBPROJECT_ID
SUFFIX            SUPPORT_YEAR      DIRECT_COST_AMT   INDIRECT_COST_AMT
TOTAL_COST        TOTAL_COST_SUB_PROJECT
```

## API Endpoints

### `GET /health`
```json
{ "status": "ok", "opensearch": "up" }
```

### `GET /search/?q=<str>&limit=<1–100>`
```json
{
  "query": "cancer",
  "limit": 25,
  "total": 12345,
  "results": [
    { "_id": "abc", "APPLICATION_ID": 123, "PROJECT_TITLE": "...", "..." }
  ]
}
```

### `GET /analytics/summary`
```json
{
  "total_documents": 76219,
  "by_category": [{ "label": "R01", "value": 4500 }],
  "time_series": []
}
```

## Code Conventions

- **Indentation:** 2 spaces (Python and TypeScript)
- **Python:** type hints on all function signatures (PEP 484); `from __future__ import annotations`
- **TypeScript:** explicit types everywhere; no `any`; use `unknown` for truly unknown shapes
- **React:** functional components only; no class components
- **Naming:** snake_case in Python, camelCase in TypeScript, PascalCase for React components and TS interfaces

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_HOST` | `localhost` | `opensearch` inside Docker; `localhost` outside |
| `OPENSEARCH_PORT` | `9200` | OpenSearch port |
| `OPENSEARCH_INDEX` | `project_data` | Index name |
| `DATA_FILE` | `2025_data.csv` | Path to data file (relative to working dir) |

Copy `.env.example` → `.env` when running the backend directly (outside Docker).

## Known Gotchas

1. **Host difference:** `OPENSEARCH_HOST=opensearch` inside Docker (service name), `localhost` outside. Docker Compose sets this automatically; `.env.example` sets it for direct runs.
2. **Docker memory:** OpenSearch requires ≥ 4 GB allocated to Docker Desktop (Settings → Resources → Memory).
3. **`category.keyword` aggregation:** `analytics.py` aggregates on `category.keyword` but the CSV has no `category` column — this returns empty buckets until a field is mapped to `category` in the indexer.
4. **Hardcoded index name:** `INDEX_NAME = "project_data"` is set in both `search.py:10` and `analytics.py:8`. If you rename the index, update both files and the `OPENSEARCH_INDEX` env var.
5. **Double `get_client()`:** `indexer/index_data.py` defines its own `get_client()` that duplicates `api/opensearch_client.py`. They are functionally identical; `reindex.py` imports from `index_data.py`.
