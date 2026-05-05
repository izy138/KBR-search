# KBR Internship Project

This repo runs three services together:

- OpenSearch (data store + search engine)
- FastAPI backend (search + analytics API)
- React frontend (user interface)

## Project Structure

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
The Dependency Chain
This is the key insight for what order to build in:
Docker/OpenSearch must exist before Python can index
Python index must exist before FastAPI can query
FastAPI must exist before React can fetch data
So you always build bottom up.
STEP 1 — Set Up Your Repo Structure
Do this first, Day 1
/project
  /backend
    /indexer
      load_data.py       ← loads Excel
      index_data.py      ← sends to OpenSearch
    /api
      main.py            ← FastAPI app
      search.py          ← search endpoints
      analytics.py       ← chart endpoints
    requirements.txt
  /frontend
    /src
      /components
        SearchBar.tsx
        ResultsList.tsx
        Filters.tsx
        Charts.tsx
  docker-compose.yml     ← spins up OpenSearch

STEP 2 — Stand Up OpenSearch in Docker
Before writing any Python
yaml
# docker-compose.yml
version: "3"
services:
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    environment:
      - discovery.type=single-node
      - DISABLE_SECURITY_PLUGIN=true
    ports:
      - 9200:9200
bash
docker-compose up -d
Then verify it's running:
bash
curl http://localhost:9200
# should return OpenSearch cluster info
Nothing else can happen until this is running.

STEP 3 — Explore and Understand the Excel Data
Before writing the indexer
python
import pandas as pd

df = pd.read_excel("nih_data.xlsx")

print(df.columns)    # what fields exist?
print(df.head())     # what does the data look like?
print(df.dtypes)     # what types are the fields?
print(df.isnull().sum())  # any missing values?
You need to understand your data before you can clean or index it. Common issues you'll find:
Column names with spaces or weird casing
Missing abstracts
Award amounts stored as strings instead of numbers


STEP 4 — Build the Python Indexer
After understanding the data
Two scripts:
load_data.py — clean and normalize
python
import pandas as pd

def load_and_clean(filepath):
    df = pd.read_excel(filepath)
    
    # normalize column names
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    
    # drop rows missing critical fields
    df = df.dropna(subset=["title", "abstract"])
    
    # fix types
    df["award_amount"] = pd.to_numeric(df["award_amount"], errors="coerce")
    df["fiscal_year"] = df["fiscal_year"].astype(int)
    
    return df
index_data.py — send to OpenSearch
python
from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk
from load_data import load_and_clean

client = OpenSearch(hosts=[{"host": "localhost", "port": 9200}])

def create_index():
    client.indices.create(index="nih_projects", body={
        "mappings": {
            "properties": {
                "title":        {"type": "text"},
                "abstract":     {"type": "text"},
                "pi_name":      {"type": "keyword"},
                "org":          {"type": "keyword"},
                "fiscal_year":  {"type": "integer"},
                "award_amount": {"type": "float"}
            }
        }
    })

def index_docs(df):
    def generate():
        for _, row in df.iterrows():
            yield {
                "_index": "nih_projects",
                "_source": row.to_dict()
            }
    bulk(client, generate())

if __name__ == "__main__":
    df = load_and_clean("nih_data.xlsx")
    create_index()
    index_docs(df)
    print(f"Indexed {len(df)} documents")
Run it once:
bash
python index_data.py
Verify it worked:
bash
curl http://localhost:9200/nih_projects/_count
# should return total document count

STEP 5 — Build FastAPI
After data is indexed
Start minimal — just get search working:
python
# main.py
from fastapi import FastAPI, Query
from opensearchpy import OpenSearch
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
client = OpenSearch(hosts=[{"host": "localhost", "port": 9200}])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/search")
def search(q: str = Query(...), page: int = 1, size: int = 10):
    res = client.search(index="nih_projects", body={
        "from": (page - 1) * size,
        "size": size,
        "query": {
            "multi_match": {
                "query": q,
                "fields": ["title^2", "abstract"]
            }
        }
    })
    return {
        "total": res["hits"]["total"]["value"],
        "results": [h["_source"] for h in res["hits"]["hits"]]
    }
Test it before touching React:
bash
uvicorn main:app --reload
# then visit http://localhost:8000/search?q=cancer
If you get JSON back, your backend is working. Add more endpoints only after this one works.STEP 6 — Build React Frontend
After API is confirmed working
Again, start minimal:
tsx
// App.tsx - just get results showing first
import { useState } from "react"

export default function App() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])

  const search = async () => {
    const res = await fetch(
      `http://localhost:8000/search?q=${query}`
    )
    const data = await res.json()
    setResults(data.results)
  }

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button onClick={search}>Search</button>

      {results.map((r, i) => (
        <div key={i}>
          <h3>{r.title}</h3>
          <p>{r.abstract}</p>
        </div>
      ))}
    </div>
  )
}
Once results are showing, then layer in: filters → pagination → charts → styling.
STEP 7 — Add Filters + Analytics
After basic search works end to end
Add filter dropdowns (org, year) — connects to /search/filtered
Add charts (Recharts/Chart.js) — connects to /analytics/by-year
Add detail view — connects to /project/{id}
Add CSV export button — connects to /export

The Full Order Summary
1. Repo structure
2. Docker → OpenSearch running
3. Explore Excel data
4. Python indexer → data in OpenSearch
5. FastAPI → /search endpoint working
6. React → results showing on screen
7. Add filters, charts, detail view, export
Each step proves the previous one works before moving on. Never skip ahead — if React isn't showing data, you need to know if the problem is in React, FastAPI, or OpenSearch.

## Changing the Index Mapping

When you add, rename, or remove a field from the CSV or change the indexer logic:

1. **Rebuild the index** (wipes and re-indexes everything):
   ```bash
   docker compose exec backend python indexer/reindex.py
   ```
2. If query fields changed, update `backend/api/search.py` and/or `backend/api/analytics.py`.
3. If response shapes changed, update the interfaces in `frontend/src/api.ts`.
4. Verify the new mapping:
   ```bash
   curl http://localhost:9200/project_data/_mapping
   ```

---

You said: Questions about open search and docker, I am in a group of 3, is there anything to know about running opensearch through docker and indexing when there are 3 ppl using it locally?
Claude responded: Great question — this is something that trips up a lot of teams.
Great question — this is something that trips up a lot of teams. Here's what you need to know:

The Core Issue
OpenSearch running in Docker is a local instance. That means:
Person A's laptop → their own OpenSearch → their own index
Person B's laptop → their own OpenSearch → their own index  
Person C's laptop → their own OpenSearch → their own index
You are NOT sharing one OpenSearch. Each person has their own isolated instance. This is actually fine for development — but your team needs to understand this.

What This Means Practically
Each person needs to:
Have Docker installed on their own machine
Run docker-compose up themselves
Run the indexer script themselves to populate their local OpenSearch
Re-index if the data or mapping changes
The Important Things to Align On
1. Everyone uses the same docker-compose.yml
This should be committed to the repo. Everyone pulls it and runs the same config. No one should be tweaking it locally.
2. Everyone uses the same index mapping
If Person A changes the mapping (adds a field, changes a type), everyone needs to:
bash
# delete old index
curl -X DELETE http://localhost:9200/nih_projects

# re-run the indexer
python index_data.py
This is a common source of bugs — someone's index is outdated and search behaves differently on their machine.
3. The Excel data file needs to be consistent
Since the data is static and provided Day 1, everyone should be working from the exact same Excel file. Commit it to the repo or share it once via Google Drive and never change it.

Recommended Team Workflow
Shared Git Repo
  ├── docker-compose.yml    ← everyone runs this
  ├── backend/
  │   ├── indexer/
  │   │   ├── index_data.py ← everyone runs this once
  │   │   └── load_data.py
  │   └── api/
  │       └── main.py
  ├── frontend/
  └── data/
      └── nih_data.xlsx     ← same file for everyone
The rule: if index_data.py or the mapping changes, everyone re-indexes.

Potential Problems to Watch Out For
Port conflicts
If someone already has something running on port 9200, Docker will fail. Fix:
yaml
# docker-compose.yml - change the left side port
ports:
  - 9201:9200  # maps local 9201 to container's 9200

Docker not having enough memory
OpenSearch is memory-hungry. It needs at least 4GB RAM allocated to Docker. Check Docker Desktop settings → Resources → Memory.
Index already exists error
If someone runs index_data.py twice:
python
# Add this check before creating
if not client.indices.exists(index="nih_projects"):
    client.indices.create(index="nih_projects", body=mapping)
Someone changes the schema
Make a helper script everyone can run:
python
# reindex.py - nuke and rebuild
def reindex():
    if client.indices.exists(index="nih_projects"):
        client.indices.delete(index="nih_projects")
    create_index()
    index_docs(df)
    print("Reindexed successfully")

Division of Work That Makes Sense for 3 People
Given the stack, a natural split is:
Person
Focus
Person 1
Python indexer + data pipeline
Person 2
FastAPI endpoints
Person 3
React frontend

But everyone should run their own Docker/OpenSearch locally so they can test the full stack independently.

The Golden Rule
Treat your local OpenSearch like a local database. It's yours. Keep it in sync with the repo.
Same way you'd run npm install after pulling new frontend changes, you run the indexer after any data/mapping changes.

only 10k results:

Because OpenSearch is capping your reported total at 10,000 in the current search request.

I verified:

Index actually has 75,995 docs (/project_data/_count)
Your API returns "total": 10000 from /search/
Why this happens:

In backend/api/search.py, client.search(...) doesn’t set track_total_hits.
OpenSearch defaults to an optimized total-hits behavior and returns up to 10k accurately unless you ask for full counting.
Also, default max_result_window is 10,000, so deep pagination with from/size past that won’t work anyway.
If you want, I can patch it so:

total count is accurate (track_total_hits: true), and
API returns total_relation too (eq / gte) so frontend knows when count is capped.
And if you need browsing past 10k, we should switch to search_after (or raise max_result_window, less ideal).