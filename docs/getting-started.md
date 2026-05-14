# Getting Started

## Prerequisites

- Docker Desktop with at least **4 GB** memory allocated (required by OpenSearch)

## Start the stack

From the repository root:

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- OpenSearch: http://localhost:9200

## Load data

After containers are healthy, index the default dataset (`2025_data.csv`):

```bash
docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

Verify documents were indexed:

```bash
curl http://localhost:8000/health
curl http://localhost:9200/project_data/_count
```

## Rebuild the index

If mappings change or the index is corrupt:

```bash
docker compose exec backend python indexer/reindex.py /app/2025_data.csv --with-embeddings
```

## Useful commands

Stop services:

```bash
docker compose down
```

Remove OpenSearch data volume:

```bash
docker compose down -v
```

Tail logs:

```bash
docker compose logs -f backend
```

## API overview

| Endpoint | Description |
| -------- | ----------- |
| `GET /health` | API and OpenSearch status |
| `GET /search/` | Full-text search with filters |
| `GET /search/similar` | Vector similarity search |
| `GET /search/hybrid` | Hybrid keyword + vector search |
| `GET /analytics/summary` | Document counts and top activities |

Full request/response details are in the [API Reference](/api).
