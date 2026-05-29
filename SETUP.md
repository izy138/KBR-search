# Local Setup How To

This guide covers everything needed to get the KBR NIH Project Search running locally from scratch. The stack consists of three services — OpenSearch (search engine), FastAPI backend, and a React/Vite frontend — all orchestrated by Docker Compose. Docker is the only supported way to run this project. The frontend and backend must not be started outside of Docker.

## 1. Prerequisites

The only tools you need on your machine before starting are:

| Tool | Minimum Version | Notes |
|------|-----------------|-------|
| Git | 2.x | For cloning the repository |
| Docker Desktop | 4.x | Required to run all services |

**Memory requirement:** OpenSearch needs at least 4 GB of RAM allocated to Docker Desktop. Go to Docker Desktop → Settings → Resources → Memory and set it to 4 GB or higher. If skipped, OpenSearch will crash on startup.

## 2. Clone the Repository

```bash
git clone https://github.com/izy138/KBR-Internship.git
cd KBR-Internship
```

## 3. Add the Data Files

Data files are not included in the repository (gitignored due to size). Obtain them from the team.

Vector embeddings are required. Loading data always goes through the `*_embedded.ndjson` files produced by `export_embeddings.py` (or supplied pre-built by the team). Do not index plain CSVs without embeddings — documents will lack vectors and semantic/similar search will not work.

### 3.1 What You Need

| File Pattern | Required For |
|--------------|--------------|
| `2020_data.csv` … `2025_data.csv` | Generating embedded NDJSON (Step 4a) — only needed if you are producing NDJSON files yourself |
| `2020_data_embedded.ndjson` … `2025_data_embedded.ndjson` | Indexing into OpenSearch (Step 4b) — required for the app to work |
| `2020_PROJECT.csv` … `2025_PROJECT.csv` | Download CSV functionality |

### 3.2 Where to Put Them

Place files inside the `backend/` directory, under `indexer/data/` for indexed data and `indexer/OGdata/` for the original export CSVs used for the download feature:

```
KBR-Internship/
└── backend/
    └── indexer/
        ├── data/          ← Index & semantic search files
        │   ├── 2020_data.csv
        │   ├── 2020_data_embedded.ndjson
        │   ├── ...
        │   ├── 2025_data.csv
        │   └── 2025_data_embedded.ndjson
        └── OGdata/        ← Download CSV functionality
            ├── 2020_PROJECT.csv
            ├── ...
            └── 2025_PROJECT.csv
```

Inside the backend container these files appear at `/app/indexer/data/` and `/app/indexer/OGdata/` respectively (the entire `backend/` folder is mounted at `/app`).

You can start with a single year (e.g. `2025_data_embedded.ndjson`) and add more later. Process one year at a time.

## 4. Start the Services

From the project root, run:

```bash
docker compose up --build
```

This starts three services:

| Service | URL | Description |
|---------|-----|-------------|
| OpenSearch | http://localhost:9200 | Search engine — takes 15–30 seconds to become healthy |
| Backend | http://localhost:8000 | FastAPI server — waits for OpenSearch before starting |
| Frontend | http://localhost:5173 | React/Vite dev server — waits for backend before starting |

Wait until all three services are running and you see no error messages. On first startup the frontend runs `npm ci`, which may take a minute.

### 4.1 Verify OpenSearch

```bash
curl http://localhost:9200
```

You should see a JSON response containing `"status" : "green"` or `"status" : "yellow"`.

### 4.2 Verify the Backend

```bash
curl http://localhost:8000/health
```

Expected response: `{"status":"ok","opensearch":"up"}`

## 5. Load Data into OpenSearch

The database starts empty. Every record must be indexed with a pre-computed embedding vector. The required flow is:

1. **Export** — encode CSV rows and write NDJSON (`export_embeddings.py`)
2. **Import** — bulk-load NDJSON into OpenSearch (`import_embeddings.py`)

If the team already provided `*_embedded.ndjson` files, skip to Step 5b.

### 5a. Generate Embedded NDJSON from CSV

Skip this step if you already have the `.ndjson` files in your data folder. This step is only needed when adding new years of data or if you need to regenerate the NDJSON files from scratch.

**Pipeline Order:**

`term_stats.py` → `term_stats.json` → `export_embeddings.py` → `*_embedded.ndjson` → `import_embeddings.py`

Term stats MUST be computed before exporting embeddings:

**Single Year:**

```bash
docker compose exec backend python indexer/term_stats.py /app/indexer/data/2025_data.csv
```

**Multi Year:**

```bash
docker compose exec backend python indexer/term_stats.py \
  /app/indexer/data/2020_data.csv \
  /app/indexer/data/2021_data.csv \
  /app/indexer/data/2022_data.csv \
  /app/indexer/data/2023_data.csv \
  /app/indexer/data/2024_data.csv \
  /app/indexer/data/2025_data.csv
```

Run once per CSV file. The default output name is `<stem>_embedded.ndjson` (e.g. `2025_data.csv` → `2025_data_embedded.ndjson`).

**Option A — Inside Docker (CPU — slow for large datasets)**

```bash
docker compose exec backend python indexer/export_embeddings.py \
    /app/indexer/data/2025_data.csv
```

**Option B — On a GPU machine (recommended for full multi-year exports)**

Run directly on a machine with a CUDA GPU. Install the dependencies first:

```bash
cd backend
pip install -r requirements.txt
# For NVIDIA GPU, install CUDA-enabled torch first:
# https://pytorch.org/get-started/locally/

python indexer/export_embeddings.py indexer/data/2025_data.csv

# Or with an explicit output path:
python indexer/export_embeddings.py indexer/data/2025_data.csv \
    --out indexer/data/2025_data_embedded.ndjson
```

Copy the resulting `*_embedded.ndjson` files into `backend/indexer/data/` on the machine running OpenSearch, then continue with Step 5b.

**Repeat for each year**

```bash
docker compose exec backend python indexer/export_embeddings.py /app/indexer/data/2020_data.csv
docker compose exec backend python indexer/export_embeddings.py /app/indexer/data/2021_data.csv
# ... through 2025
```

### 5b. Import NDJSON into OpenSearch

**Errors to keep in mind for this section:**

Windows users: If `docker compose exec backend` fails with a "no such service" error, your container may be named `kbr-backend`. Either run the command from the repo root directory (where `docker-compose.yml` lives), or use Docker Desktop's container Exec tab to run the python command directly inside the `kbr-backend` container.

The paths like `/app/indexer/data/2025_data_embedded.ndjson` get corrupted by Git Bash on Windows.

**Windows + Git Bash users:** Git Bash automatically converts Unix-style paths (e.g. `/app/...`) into Windows paths, which breaks these commands. Use one of these alternatives:

- Run the commands in PowerShell or CMD instead
- Or prefix the command with `MSYS_NO_PATHCONV=1` to disable path conversion:

```bash
MSYS_NO_PATHCONV=1 docker compose exec backend python indexer/import_embeddings.py /app/indexer/data/2025_data_embedded.ndjson
```

This is the only supported way to load data for this project. Do not run `index_data.py` on plain CSV for initial setup — documents will lack embedding vectors.

**Single year**

```bash
docker compose exec backend python indexer/import_embeddings.py \
    /app/indexer/data/2025_data_embedded.ndjson
```

**All years**

```bash
docker compose exec backend python indexer/import_embeddings.py \
  /app/indexer/data/2020_data_embedded.ndjson \
  /app/indexer/data/2021_data_embedded.ndjson \
  /app/indexer/data/2022_data_embedded.ndjson \
  /app/indexer/data/2023_data_embedded.ndjson \
  /app/indexer/data/2024_data_embedded.ndjson \
  /app/indexer/data/2025_data_embedded.ndjson
```

`import_embeddings.py` creates the index with k-NN enabled if it does not exist yet. Re-importing the same file is safe — documents are upserted by `APPLICATION_ID`, so no duplicates are created.

### 5c. Verify Data Loaded

```bash
curl http://localhost:9200/project_data/_count
```

The `"count"` value should match the number of records in your NDJSON file(s). To confirm vectors exist:

```bash
curl -s "http://localhost:9200/project_data/_search?size=1" | grep -o '"embedding"'
```

You should see `"embedding"` in the response.

## 6. Open the Application

Once services are running and data is loaded, open http://localhost:5173 in your browser. Try a keyword search and the semantic/hybrid search to confirm everything is working.

| Page | URL |
|------|-----|
| Search | http://localhost:5173/search |
| Dashboard | http://localhost:5173/dashboard |
| Backend API docs (Swagger) | http://localhost:8000/docs |
| OpenSearch cluster health | http://localhost:9200/_cluster/health |

## 7. Common Operations

### Stop the Services

```bash
docker compose down
```

Indexed data is preserved in a Docker volume (`opensearch-data`). When you run `docker compose up` again, the data is still there — no need to re-import.

### Stop and Delete All Data

```bash
docker compose down -v
```

The `-v` flag removes Docker volumes, which deletes the OpenSearch index. You will need to run Step 5b again (and Step 5a if you no longer have the NDJSON files).

### Wipe and Rebuild the Index

Delete the index, then re-import embedded NDJSON:

```bash
curl -X DELETE "http://localhost:9200/project_data"
docker compose exec backend python indexer/import_embeddings.py \
    /app/indexer/data/2025_data_embedded.ndjson
```

### Append a New Year of Data

Use `append_data.py` to add new data without wiping the existing index. The file path is passed as a positional argument:

```bash
# Append a new NDJSON file (recommended — preserves embeddings)
docker compose exec backend python indexer/import_embeddings.py \
    /app/indexer/data/2026_data_embedded.ndjson

# Or append a CSV directly (re-computes embeddings on the fly — slow on CPU)
docker compose exec backend python indexer/append_data.py \
    /app/indexer/data/2026_data.csv --with-embeddings
```

**Note:** `append_data.py` takes a positional path argument — there is no `--file` flag.

### Rebuild Just One Container

For example, after changing backend code:

```bash
docker compose up --build backend
```

### Run Frontend Type-Checking

```bash
docker compose exec frontend npx tsc --noEmit
# or from the frontend/ directory on your host:
cd frontend && npx tsc --noEmit
```

## 8. Environment Variables Reference

All variables have safe defaults for local development. Set them in your shell or in a `.env` file before starting the backend container.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_HOST` | `localhost` | Hostname or IP of the OpenSearch node |
| `OPENSEARCH_PORT` | `9200` | HTTP port for OpenSearch |
| `OPENSEARCH_INDEX` | `project_data` | Name of the OpenSearch index to create and query |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins for the API. Update this if the frontend runs on a different port — do not edit `main.py` directly |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | HuggingFace model name for embeddings. Must match the model used at index time — changing after indexing requires a full reindex |
| `EMBEDDING_DEVICE` | `auto` | Device for embedding inference. `auto` selects CUDA → MPS (Apple Silicon) → CPU. Accepted values: `auto`, `cuda`, `cuda:N`, `mps`, `cpu` |
| `EMBEDDING_ENCODE_BATCH_SIZE` | `32` | Texts encoded per `model.encode()` call. Increase on GPU (e.g. `128`) for faster throughput |
| `EMBEDDING_ABSTRACT_MAX_CHARS` | `12000` | Maximum characters of `ABSTRACT_TEXT` included in the embedding text. Set to `0` for no truncation |
| `EMBEDDING_TERM_STATS_PATH` | `term_stats.json` | Path to the precomputed term-frequency file from `term_stats.py`. Used to strip overly common terms before embedding |
| `EMBEDDING_TERM_MAX_DF_RATIO` | `0.20` | Document-frequency ratio above which a `PROJECT_TERM` is considered generic and stripped before embedding (e.g. 'research', 'data') |
| `EMBEDDING_SHOW_PROGRESS` | (unset) | Set to `1` to show a per-batch progress bar during indexing |

## 9. Troubleshooting

### OpenSearch keeps crashing or restarting

**Cause:** Not enough memory allocated to Docker Desktop.

**Fix:** Docker Desktop → Settings → Resources → Memory → set to 4 GB or more. Restart Docker Desktop.

### `curl http://localhost:9200` — connection refused

**Cause:** OpenSearch hasn't finished starting yet (takes 15–30 seconds).

**Fix:** Wait and try again. Check `docker compose logs opensearch` for errors.

### Backend can't connect to OpenSearch

**Cause:** OpenSearch wasn't healthy when the backend tried to connect.

**Fix:** The Docker Compose health check handles this automatically. If it persists, run `docker compose down && docker compose up --build`.

### Frontend shows network errors

**Cause:** Backend isn't running, or the frontend can't reach it.

**Fix:** Verify the backend is running at http://localhost:8000/health. The frontend expects the backend at http://localhost:8000 by default (set via the `VITE_API_BASE_URL` env var).

### Search returns no results

**Cause:** Data hasn't been imported yet.

**Fix:** Complete Step 5b, then verify with `curl http://localhost:9200/project_data/_count`.

### Semantic / vector search returns no results

**Cause:** Documents were indexed without embeddings (e.g. plain CSV via `index_data.py` without `--with-embeddings`), or NDJSON was never imported.

**Fix:** Delete the index and re-import embedded NDJSON (see Section 7 — Wipe and Rebuild the Index). Ensure each NDJSON line includes an embedding array.

### 'No stored vector' error on Similar Projects panel

**Cause:** That specific document was indexed without an embedding vector.

**Fix:** Re-import the NDJSON file that contains this document, or wipe and rebuild the index with embeddings.

### `export_embeddings.py` is very slow in Docker

**Cause:** The default backend image runs the embedding model on CPU.

**Fix:** Run `export_embeddings.py` on a machine with a CUDA/MPS GPU (see Step 5a, Option B), then copy the `*_embedded.ndjson` files to the Docker machine and run `import_embeddings.py` in Docker.

### CORS errors in the browser

**Cause:** The frontend is running on a port other than 5173.

**Fix:** Set the `CORS_ORIGINS` environment variable to include the correct frontend origin (e.g. `CORS_ORIGINS=http://localhost:3000`). Do not edit `main.py` directly.

### `npm ci` fails in the frontend container

**Cause:** Stale `node_modules` volume.

**Fix:**

```bash
docker compose down -v
docker compose up --build
```

### Empty filter dropdowns

**Cause:** The filter catalog endpoint (`GET /search/filter-catalog`) is called on mount. If the index is empty or OpenSearch is unreachable, the dropdowns will show no options.

**Fix:** Check the browser console for the underlying error. Verify OpenSearch is reachable and data has been loaded (Step 5b).
