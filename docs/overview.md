# KBR Internship

NIH grant search and analytics app. CSV data is indexed into OpenSearch; a FastAPI backend serves search and analytics; a React frontend provides the UI.

## Documentation map

| Page | Topics |
| ---- | ------ |
| **Overview** (this page) | Quick start and repo layout |
| **User guide** | How to use the web app (Search, Dashboard, Vector lab) |
| **Architecture** | How frontend, backend, and OpenSearch connect |
| **Frontend** | Routes, pages, which API each component calls |
| **Backend API** | Search, analytics, and embedding endpoints |
| **Data & indexing** | CSV fields, indexer, embeddings, OpenSearch |
| **Indexing & embeddings** | Docker inline embed vs NDJSON import (step-by-step) |
| **Term stats filtering** | How common PROJECT_TERMS are measured and stripped before embed |
| **Semantic search** | OpenSearch k-NN, embeddings, hybrid RRF |

See [Backend API](backend.md) for full request/response details.

## Stack

| Service | Tech | URL |
| ------- | ---- | --- |
| Frontend | React, TypeScript, Vite | http://localhost:5173 |
| Backend | Python, FastAPI | http://localhost:8000 |
| Search | OpenSearch | http://localhost:9200 |

## Run locally

**Prerequisites:** Docker Desktop with at least 4 GB RAM for OpenSearch.

```bash
docker compose up --build
```

**Load data** (first time, or after wiping the index):

```bash
docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

**Check it worked:**

```bash
curl http://localhost:8000/health
curl http://localhost:9200/project_data/_count
```

**Stop:**

```bash
docker compose down
```

## Repo layout

```text
backend/api/           FastAPI routes (search, analytics)
backend/indexer/       CSV load, embeddings, bulk index
backend/*.csv          NIH export data (2020–2025)
frontend/src/          React app (App.tsx, api.ts, components/)
docs/                  Documentation (this site)
docs/plain/            Same docs as plain .txt (for Word / Google Docs)
scripts/export_docs_plain.py  Regenerate plain-text exports
docker-compose.yml     Local dev stack
```
