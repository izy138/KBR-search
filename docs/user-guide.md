# User guide

This guide explains how to use the **NIH Project Search** web app at http://localhost:5173 after the stack is running and data is loaded.

## Before you start

1. Start the app (Docker): `docker compose up --build`
2. Load data at least once:  
   `docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings`
3. Open http://localhost:5173 in your browser.

If pages are empty or searches return nothing, the index may not be loaded yet. See the technical docs or ask whoever set up the environment.

---

## Navigation

The header has three main areas:

| Tab | What it is |
| --- | ---------- |
| **Search** | Find grants by keywords and filters; browse results in a table |
| **Dashboard** | Charts and maps summarizing funding across the dataset |
| **Vector lab** | Semantic (meaning-based) and hybrid search experiments |

Click **NIH Project Search** (top left) to return to the home search view.

### Appearance

- **Dark mode / Light mode** — toggle in the top-right header.
- **Light theme** — when in light mode, choose a color palette (Default, Blue accent, Yellow beige, Mint slate, Blue modified). Your choice is remembered in the browser.

---

## Search

### Run a search

1. Open the **Search** tab.
2. Type keywords in the search bar (project title, topic, PI name, organization, etc.).
3. Press Enter or submit the search.

Results appear in a table with project title, principal investigator, organization, institute, state, activity code, fiscal year, and total cost.

### Sort results

Use the sort control above the table:

- **Most relevant** — order from the search engine (default).
- **Title A→Z / Z→A** — alphabetical by project title.

You can also click column headers to sort by PI, organization, institute, state, activity, fiscal year, or total cost.

### Open a project

Click a row to open the **project details** page for that grant.

### Pagination

- Change **results per page** (e.g. 25, 50, 100).
- Use **← / →** or page numbers to move through results.
- Type a page number in **Jump to page** and press Enter.

Very deep pagination is limited (the backend caps how far you can page into results).

### Filters (left sidebar)

Narrow results before or after searching:

| Filter | What it does |
| ------ | ------------- |
| **Principal Investigator** | Text match on PI name |
| **NIH Institute / Center** | Dropdown of institutes seen in current data |
| **Activity Code** | Grant mechanism code (e.g. R01, F32) |
| **State** | U.S. state where the organization is located |
| **Fiscal Year** | From / To year range |

Click **Apply filters** to run the search with your choices. Click **Clear** to reset all filters.

**Note:** Institute, activity, and state dropdown options on the Search tab are built from the **current result set**, not the full database. Run a broad search first if you need more filter options.

---

## Project details

From any result row, open a project to see:

- **Title** and **abstract** (with Read more for long abstracts)
- **Principal investigators** — click a name to see all grants for that PI
- **Organization**, location, institute, activity code, fiscal year, funding
- **Project terms** (NIH keyword tags)
- **Other fiscal years** — if the same award appears in multiple years, switch years with the FY tags at the top
- **Similar grants** — semantically related projects (requires embeddings at index time)
- **Activity comparison chart** — how this project’s funding compares to others with the same activity code

Use **Back to results** to return to search.

**Similar grants (vectors)** — opens the Vector lab page focused on this project’s embedding neighbors.

---

## Investigator page

Click a PI name on a project or in the results table to open **all projects** for that investigator.

- Results are sorted by fiscal year (newest first).
- Paginate with the controls at the bottom.
- Click any row to open that project’s detail page.
- **Back to results** returns to your previous search view.

---

## Dashboard

The **Dashboard** tab shows aggregate analytics for the indexed dataset.

### Summary cards (top)

- **Total Funding** — sum of grant costs in the index
- **Total Projects** — number of documents
- **Avg Grant** — average funding per project

### Charts and map

| Panel | What you see |
| ----- | ------------ |
| **U.S. state map** | Color intensity by funding or project count per state (hover for values) |
| **Projects by Institute (IC)** | Horizontal bar chart; filter by fiscal year (All or a specific year); switch **Linear** / **Log** scale on the count axis |
| **Funding by Activity Code** | Which grant mechanisms receive the most total funding |
| **Projects & Funding by Year** | Trends over fiscal year |
| **Top Organizations by Funding** | Leading recipient institutions |
| **Average Grant by Institute (IC)** | Mean award size per NIH institute |
| **Project term themes** | Word cloud of common research themes (from precomputed analysis) |
| **Funding share by Activity** | Pie chart of funding by activity type |

### Search and filters on the dashboard

The dashboard has its own **search bar** and the same **sidebar filters** as Search. Use them to explore subsets of the data where supported (filter options come from dashboard analytics data).

If the dashboard shows “Unable to load” or stays on “Loading analytics…”, the API or OpenSearch may be down, or the index may be empty.

---

## Vector lab

The **Vector lab** explores **semantic search**: finding grants by meaning, not only exact keywords. It requires the dataset to have been indexed **with embeddings**.

### 1 — Pick a project, then see similar grants

1. Enter a few keywords (e.g. “Alzheimer tau imaging”) and click **Find projects**.
2. Click a result row (**Similar grants →**) to open a page of grants most similar to that project in embedding space.

Or paste an OpenSearch document **\_id** (the id in the URL `/projects/...`) and click **Open similar page**.

### 2 — Semantic search from a sentence

Describe the research you want in plain language (a sentence or short paragraph). Set **k** (how many results, default 12). Submit to run pure semantic k-NN search.

Example: *“CRISPR base editing cardiovascular disease”*

Good when you know the **concept** but not the exact words in grant titles.

### 3 — Hybrid search

Combines **keyword** and **semantic** search, then merges rankings. Enter a query, set **k**, and optionally filter by **activity**, **state**, and **fiscal year**.

Good when you want both exact terms (e.g. a gene name) and related topical matches.

### Result snippets

Each hit shows title, activity code, fiscal year, institute, and document id. Open a grant from the main Search or project pages for full details.

### If semantic search fails

- First request may be slow while the embedding model loads.
- Errors about embeddings or **409** usually mean the index was built without `--with-embeddings` or with a different model. An administrator needs to reindex.

---

## Tips

| Goal | Suggestion |
| ---- | ---------- |
| Find a known PI | Search their name or use the PI filter |
| Explore a topic | Start with Search; try Vector lab for broader concepts |
| Compare funding geography | Use Dashboard state map |
| See trends over time | Dashboard “Projects & Funding by Year” |
| Find “grants like this one” | Project details → Similar grants, or Vector lab section 1 |
| Same award, different years | Project details → FY tags at the top |

---

## Glossary (quick)

| Term | Meaning |
| ---- | ------- |
| **PI** | Principal Investigator — lead researcher on the grant |
| **IC** | NIH Institute or Center (e.g. NCI, NIA) |
| **Activity code** | Grant mechanism (R01, R21, F32, etc.) |
| **FY** | Fiscal year of the award |
| **ORG / State** | Recipient organization and its U.S. state |
| **Semantic / vector search** | Match by meaning using AI embeddings, not just keywords |
| **Hybrid search** | Keyword + semantic search combined |

---

## Getting help

- **Empty results** — widen search terms; clear filters; confirm data is indexed.
- **Dashboard won’t load** — check http://localhost:8000/health
- **Vector lab errors** — confirm embeddings were enabled when data was indexed.

For setup, architecture, and API details, see the other documentation pages in this site.
