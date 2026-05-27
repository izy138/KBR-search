# KBR NIH Project Search — Setup Guide

This guide walks you through setting up the project from scratch on a new machine.

---

## Prerequisites

Before you start, make sure you have the following installed:

| Tool | Minimum Version | Install |
|------|----------------|---------|
| **Git** | 2.x | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | 4.x | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js** (optional, for running frontend outside Docker) | 20.x | [nodejs.org](https://nodejs.org/) |
| **Python** (optional, for running backend outside Docker) | 3.12 | [python.org](https://www.python.org/) |

> **Docker memory requirement:** OpenSearch needs at least **4 GB** of RAM allocated to Docker Desktop. Go to **Docker Desktop → Settings → Resources → Memory** and set it to 4 GB or higher. If you skip this, OpenSearch will crash on startup.

---

## 1. Clone the Repository

```bash
git clone https://github.com/izy138/KBR-Internship.git
cd KBR-Internship
```

---

## 2. Add the Data Files

The data files are **not included in the repository** (they are gitignored due to their size). Obtain them from the team.

This project **requires vector embeddings** for semantic and similar project search. Loading data into OpenSearch always goes through **embedded NDJSON** files produced by `export_embeddings.py` (or supplied pre-built by the team). Do **not** use `index_data.py` without embeddings for setup — that path leaves documents without vectors.

### What you need

| File | Required for | Naming |
|------|----------------|--------|
 `2020_data.csv` … `2025_data.csv` 
 `2020_data_embedded.ndjson` … `2025_data_embedded.ndjson` 

You need the **NDJSON** files before the app is fully usable. CSV is required on your machine only if you are generating those NDJSON files yourself.

### Where to put them

Place files in the **`backend/`** directory (same level as `api/` and `indexer/`):

```
KBR-Internship/
└── backend/
    └── indexer/
        └── data/
            ├── 2020_data.csv
            ├── 2020_data_embedded.ndjson
            ├── …
            ├── 2025_data.csv
            └── 2025_data_embedded.ndjson
```

Inside the backend container they appear as `/app/<filename>` (the whole `backend/` folder is mounted at `/app`).

> **Note:** You can start with a single year (e.g. `2025_data.csv` and `2025_data_embedded.ndjson`) and add more later. Process one year at a time.

---

## 3. Start the Services

From the project root, run:

```bash
docker compose up --build
```

This starts three services:

| Service | URL | Description |
|---------|-----|-------------|
| **OpenSearch** | http://localhost:9200 | Search engine (takes ~15–30 seconds to become healthy) |
| **Backend** | http://localhost:8000 | FastAPI server (waits for OpenSearch before starting) |
| **Frontend** | http://localhost:5173 | React dev server (waits for backend before starting) |

Wait until you see output from all three services and no error messages. The frontend will run `npm ci` on first startup, which may take a minute.

### Verify OpenSearch is running

```bash
curl http://localhost:9200
```

You should see a JSON response with `"status" : "green"` or `"status" : "yellow"`.

### Verify the backend is running

```bash
curl http://localhost:8000/health
```

You should see: `{"status":"ok","opensearch":"up"}`

---

## 4. Load Data into OpenSearch (embeddings required)

The database starts empty. Every record must be indexed **with** a pre-computed `embedding` vector. The required flow is:

1. **Export** — encode CSV rows and write NDJSON (`export_embeddings.py`).
2. **Import** — bulk-load NDJSON into OpenSearch (`import_embeddings.py`).

If the team already gave you `*_embedded.ndjson` files, skip to **Step 4b**.


### Step 4a — Generate embedded NDJSON from CSV 
THIS DOES NOT NEED TO BE DONE IF YOU ALREADY HAVE THE .NDJSON FILES IN YOUR DATA FOLDER.
This is only needed when adding additional years to the project.

Run once per CSV file. Default output name is `<stem>_embedded.ndjson` (e.g. `2025_data.csv` → `2025_data_embedded.ndjson`).

**Inside Docker** (works, but encoding on CPU is slow):

```bash
docker compose exec backend python indexer/export_embeddings.py /app/2025_data.csv
```

**On a GPU machine** (recommended for full multi-year exports):

```bash
cd backend
pip install -r requirements.txt
python indexer/export_embeddings.py 2025_data.csv
```

Copy the resulting `*_embedded.ndjson` files into `backend/` on the machine that runs OpenSearch.

Repeat for each year you have:

```bash
docker compose exec backend python indexer/export_embeddings.py /app/2020_data.csv
docker compose exec backend python indexer/export_embeddings.py /app/2021_data.csv
# … through 2025
```

### Step 4b — Import NDJSON into OpenSearch

This is the **only** supported way to load data for this project. Do not run `index_data.py` on CSV for initial setup.

**Single year:**

```bash
docker compose exec backend python indexer/import_embeddings.py /app/2025_data_embedded.ndjson
```

**All years:**

```bash
docker compose exec backend python indexer/import_embeddings.py \
  /app/2020_data_embedded.ndjson \
  /app/2021_data_embedded.ndjson \
  /app/2022_data_embedded.ndjson \
  /app/2023_data_embedded.ndjson \
  /app/2024_data_embedded.ndjson \
  /app/2025_data_embedded.ndjson
```

`import_embeddings.py` creates the index with k-NN enabled if it does not exist yet.

### Verify data loaded

```bash
curl http://localhost:9200/project_data/_count
```

The `"count"` should match the number of lines in your NDJSON file(s). It should be  Spot-check that vectors exist:

```bash
curl -s "http://localhost:9200/project_data/_search?size=1" | grep -o '"embedding"'
```

You should see `"embedding"` in the response.

---

## 5. Open the Application

Once the services are running and data is loaded, open your browser to:

**http://localhost:5173**

You should see the search interface. Try keyword search and semantic/hybrid features to confirm embeddings are present.

---

## Common Operations

### Stop the services

```bash
docker compose down
```

Your indexed data is preserved in a Docker volume (`opensearch-data`). When you run `docker compose up` again, the data is still there — no need to re-import.

### Stop and delete all data

```bash
docker compose down -v
```

The `-v` flag removes Docker volumes, which deletes the OpenSearch index. You will need to run Step 4b again (and Step 4a if you no longer have the NDJSON files).

### Wipe and rebuild the index

Delete the index, then re-import embedded NDJSON:

```bash
curl -X DELETE "http://localhost:9200/project_data"
docker compose exec backend python indexer/import_embeddings.py /app/2025_data_embedded.ndjson
```

To rebuild from CSV, run Step 4a again first, then import.

### Rebuild just one container (e.g., after changing backend code)

```bash
docker compose up --build backend
```

### Run frontend type-checking

```bash
cd frontend && npx tsc --noEmit
```

---

## Troubleshooting

### OpenSearch keeps crashing or restarting

**Cause:** Not enough memory allocated to Docker Desktop.
**Fix:** Docker Desktop → Settings → Resources → Memory → set to **4 GB** or more. Restart Docker Desktop.

### `curl http://localhost:9200` connection refused

**Cause:** OpenSearch hasn't finished starting yet (it takes 15–30 seconds).
**Fix:** Wait and try again. Check `docker compose logs opensearch` for errors.

### Backend can't connect to OpenSearch

**Cause:** OpenSearch isn't healthy yet when the backend tries to connect.
**Fix:** The Docker Compose health check should handle this automatically. If it persists, restart with `docker compose down && docker compose up --build`.

### Frontend shows network errors

**Cause:** Backend isn't running, or the frontend can't reach it.
**Fix:** Verify the backend is running at http://localhost:8000/health. The frontend expects the backend at `http://localhost:8000` by default (set via `VITE_API_BASE_URL`).

### Search returns no results

**Cause:** Data hasn't been imported yet.
**Fix:** Complete Step 4b, then verify with `curl http://localhost:9200/project_data/_count`.

### Semantic/vector search returns no results

**Cause:** Documents were loaded without embeddings (e.g. plain `index_data.py` without vectors), or NDJSON was never imported.
**Fix:** Delete the index and re-import embedded NDJSON (see **Wipe and rebuild the index** above). Ensure Step 4a completed successfully and each NDJSON line includes an `embedding` array.

### `export_embeddings.py` is very slow in Docker

**Cause:** The default backend image runs the embedding model on CPU.
**Fix:** Run `export_embeddings.py` on a machine with CUDA/MPS, copy the `*_embedded.ndjson` files to `backend/`, then run `import_embeddings.py` in Docker.

### `npm ci` fails in the frontend container

**Cause:** Stale `node_modules` volume.
**Fix:** Remove the volume and rebuild:
```bash
docker compose down -v
docker compose up --build
```

---

## Project URLs (when running)

| Page | URL |
|------|-----|
| Search | http://localhost:5173/search |
| Dashboard | http://localhost:5173/dashboard |
| Backend API docs (Swagger) | http://localhost:8000/docs |
| OpenSearch cluster health | http://localhost:9200/_cluster/health |
