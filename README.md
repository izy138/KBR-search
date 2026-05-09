# KBR Internship Project

This repo runs three services together:

- OpenSearch (data store + search engine)
- FastAPI backend (search + analytics API)
- React frontend (user interface)

## Project Structure

# Commands to connect merged_project_data.csv
for first time use, to start up docker use

docker compose up --build -d

After Docker starts up, then to load the file onto OpenSearch user

docker compose exec backend python indexer/index_data.py




```text
backend/
  indexer/
    load_data.py
    index_data.py
  api/
    __init__.py
    main.py
    opensearch_client.py
    search.py
    analytics.py
  requirements.txt
  Dockerfile
frontend/
  src/
    App.tsx
    main.tsx
    styles.css
    components/
      SearchBar.tsx
      ResultsList.tsx
      Filters.tsx
      Charts.tsx
  Dockerfile
docker-compose.yml
2025_ProjectData.csv
```

## Prerequisites

- Docker Desktop running
- At least 4 GB memory allocated to Docker (OpenSearch requirement)

## Quick Start

From repo root:

```bash
docker compose up --build
```

Services:

- Frontend: [http://localhost:5173](http://localhost:5173)
- FastAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenSearch: [http://localhost:9200](http://localhost:9200)

## Load Data Into OpenSearch

After the stack is up, run indexing once:

```bash
docker compose exec backend python indexer/index_data.py
```

Verify:

```bash
curl http://localhost:9200/project_data/_count
```

## Useful Commands

Stop everything:

```bash
docker compose down
```

Stop and remove OpenSearch data volume:

```bash
docker compose down -v
```

Tail logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f opensearch
```

## API Endpoints

- `GET /health` - API + OpenSearch health status
- `GET /search/?q=<text>&limit=<n>` - full-text search
- `GET /analytics/summary` - total docs + top categories

## Notes

- Frontend calls FastAPI at `http://localhost:8000`.
- FastAPI talks to OpenSearch by service name `opensearch` inside Docker network.
- OpenSearch security is disabled for local development only.
Full Architecture + Implementation Order

How Everything Connects
[Excel Files]
     ↓ pandas reads it
[Python Indexer Script]
     ↓ bulk indexes documents
[OpenSearch - Docker]
     ↑ ↓ queries / returns results
[FastAPI - Python]
     ↑ ↓ HTTP requests / JSON responses
[React Frontend]
     ↑
  (user)
Every layer only talks to the layer directly next to it. React never touches OpenSearch directly — it always goes through FastAPI.
