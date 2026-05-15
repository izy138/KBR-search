# KBR Internship — Project Ground Truth

## Stack

| Layer | Technology | Local Port |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript 5.9 + Vite 7 | 5173 |
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
│   │   ├── search.py            # /search/ endpoints (keyword, vector, hybrid)
│   │   ├── analytics.py         # /analytics/ endpoints (summary, by-state, etc.)
│   │   ├── embeddings.py        # Lazy-loaded sentence-transformers singleton
│   │   └── query_filters.py     # Filter parameter parsing utilities
│   ├── indexer/
│   │   ├── load_data.py         # CSV → list[dict]
│   │   ├── index_data.py        # Bulk index into OpenSearch
│   │   ├── reindex.py           # Wipe + rebuild index (one command)
│   │   └── ...                  # Embedding export/import, term stats, notebooks
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── api.ts               # Typed fetch helpers + response interfaces
│       ├── App.tsx              # Root component, routing, layout shell
│       ├── main.tsx             # React DOM entry point
│       ├── styles.css           # Global styles + CSS custom properties (6 themes)
│       ├── hooks/
│       │   ├── useSearch.ts         # Search query, results, loading, filters
│       │   ├── useFilterCatalog.ts  # Shared filter options (cached at module level)
│       │   ├── useProjectDetails.ts # Single project fetch with results-cache check
│       │   ├── useInvestigatorProjects.ts # Paginated investigator projects
│       │   ├── usePagination.ts     # Pagination state and handlers
│       │   └── useTheme.ts          # Dark/light mode + light theme variants
│       ├── utils/
│       │   ├── format.ts            # formatDollarsCompact, formatDollarsFull
│       │   ├── piNames.ts           # PI name parsing and ordering
│       │   └── recurrenceGrouping.ts # Group similar projects by recurrence
│       └── components/
│           ├── search/              # Keyword search view
│           │   ├── SearchBar.tsx
│           │   ├── ResultsList.tsx
│           │   ├── Filters.tsx      # Fully controlled filter panel (no forwardRef)
│           │   └── TermCloud.tsx    # Hierarchical term browser
│           ├── dashboard/           # Analytics dashboard view
│           │   ├── Dashboard.tsx    # Lazy-loaded; fetches 9 endpoints in parallel
│           │   ├── StateMap.tsx     # US choropleth map
│           │   └── ProjectTermsThemeCloud.tsx
│           ├── charts/              # Reusable chart components (shared by dashboard + project)
│           │   ├── Charts.tsx
│           │   ├── BarChartPanel.tsx
│           │   ├── LineChartPanel.tsx
│           │   ├── ActivityFundingPiePanel.tsx
│           │   └── VerticalOnlyBarShape.tsx
│           ├── project/             # Single project detail view
│           │   ├── ProjectDetailsPage.tsx  # Lazy-loaded
│           │   ├── ProjectActivityTermsChart.tsx
│           │   ├── ProjectSimilarProjectsChart.tsx
│           │   └── SimilarProjectYearTags.tsx
│           ├── investigator/        # Investigator projects view
│           │   └── InvestigatorPage.tsx
│           ├── semantic/            # Vector lab views
│           │   ├── SemanticVectorLabPage.tsx   # Lazy-loaded
│           │   └── SemanticSimilarProjectPage.tsx  # Lazy-loaded
│           └── shared/              # Cross-cutting components
│               ├── ErrorBoundary.tsx  # Class component (React requirement)
│               └── Pagination.tsx     # Used by search + investigator pages
├── docker-compose.yml
├── .env.example
└── docs/                        # Architecture and user docs
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

Frontend type-check (no build required):
```bash
cd frontend && npx tsc --noEmit
```

## OpenSearch Index

- **Index name:** `project_data`
- **Mapping:** dynamic (OpenSearch infers types from CSV values)
- **Data source:** `2020_data.csv` … `2025_data.csv` in `backend/indexer/data/` — each mounted read-only at `/app/<name>` inside the backend container.

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

### Health
- `GET /health` → `{ "status": "ok", "opensearch": "up" }`

### Search
- `GET /search/?q=<str>&limit=<1–100>&page=<int>&pi=&ic=&activity=&state=&fy_min=&fy_max=&project_terms=`
- `GET /search/project/{id}` — single project by document ID
- `GET /search/project/{id}/other-years` — fiscal year variants for a project
- `GET /search/investigator/{name}?limit=&page=` — projects by PI name
- `GET /search/similar?q=<str>&k=<int>` — k-NN vector search by text
- `GET /search/similar/{id}?k=<int>` — k-NN similar to existing project
- `GET /search/hybrid?q=<str>&k=<int>&activity=&state=&fy_min=&fy_max=` — BM25 + k-NN fused

### Analytics
- `GET /analytics/summary` — total documents, funding, unique ICs/activities
- `GET /analytics/by-state` — project count and funding per state
- `GET /analytics/by-ic` — project count per institute/center
- `GET /analytics/by-activity?limit=` — activity codes with funding
- `GET /analytics/by-activity-funding-pie?pie_slices=&merge_other=` — pie chart data
- `GET /analytics/by-year` — year-over-year trends
- `GET /analytics/top-orgs` — top organizations by funding
- `GET /analytics/avg-grant-by-ic` — average grant size per IC
- `GET /analytics/project-term-theme-cloud` — term frequency word cloud
- `GET /analytics/term-tree` — hierarchical term structure
- `GET /analytics/by-activity-terms?activity_id=&limit=` — terms for an activity
- `GET /analytics/by-activity-project-compare?project_id=&activity_id=&limit=` — compare project to peers

All analytics endpoints accept optional filter params: `pi`, `ic`, `activity`, `state`, `fy_min`, `fy_max`.

---

## Code Conventions

### General
- **Indentation:** 2 spaces everywhere (Python, TypeScript, CSS, JSON, YAML)
- **No comments by default.** Only add a comment when the WHY is non-obvious. Never explain WHAT code does.
- **No unnecessary abstractions.** Three similar lines > a premature helper. Don't design for hypothetical requirements.
- **Stay focused.** Only modify files the task actually requires.

### Python
- Type hints on all function signatures (PEP 484)
- `from __future__ import annotations` in all modules
- snake_case for functions and variables
- UPPERCASE_SNAKE_CASE for constants
- Module docstrings at the top of each file

### TypeScript
- Explicit types everywhere — no `any`, use `unknown` only for truly unknown shapes
- `type` keyword for type-only imports: `import type { Foo } from "./bar"`
- camelCase for functions, variables, hooks
- PascalCase for components, interfaces, type aliases
- `type` for prop definitions (not `interface`)
- No index signatures (`[key: string]: unknown`) on data interfaces — add fields explicitly

### React
- Functional components only (ErrorBoundary.tsx is the sole exception — React requires a class)
- Named imports from `"react"`, never `import React from "react"` (the project uses `jsx: "react-jsx"`)
- Custom hooks for any logic involving state + side effects — keep components focused on rendering
- All `<button>` elements must have an explicit `type` attribute (`type="button"` or `type="submit"`)
- Lazy-load heavy route components with `React.lazy()` + `<Suspense>`
- Wrap route-level components in `<ErrorBoundary>` to isolate crashes

### Frontend Architecture Patterns

**Components are grouped by feature/page.** Each subdirectory under `components/` owns one view or concern:
- `search/` — keyword search view (SearchBar, ResultsList, Filters, TermCloud)
- `dashboard/` — analytics dashboard and its dashboard-only subcomponents
- `charts/` — reusable chart panels shared across dashboard and project views
- `project/` — single project detail page and its subcomponents
- `investigator/` — investigator projects page
- `semantic/` — vector lab and semantic similar pages
- `shared/` — cross-cutting components used by multiple features (ErrorBoundary, Pagination)

New components go in the feature directory they belong to. If a component is used by 2+ features, it goes in `shared/`. Chart components used across pages go in `charts/`.

**Hooks own state. Components own rendering.**
- `useSearch` — query state, results, loading, API calls
- `useFilterCatalog` — shared filter options with module-level promise cache (fetch once, share everywhere)
- `useProjectDetails` — single project fetch, checks results cache before hitting API
- `useInvestigatorProjects` — paginated investigator results
- `useTheme` — dark/light mode, light theme variants, localStorage persistence

**Filters are fully controlled.** Parent owns all filter values and passes `onChange` callbacks per field. No `forwardRef` / `useImperativeHandle`.

**Dollar formatting is centralized.** Use `formatDollarsCompact` (charts, KPI cards) or `formatDollarsFull` (tables, detail views) from `utils/format.ts`. Do not create local formatting functions.

**Routing is URL-driven.** The `view` (search vs dashboard) is derived from `location.pathname`, not stored in React state. `/` = search, `/dashboard` = dashboard. This ensures browser refresh preserves the current view.

**`SearchResultRecord` in `api.ts` must list all fields explicitly.** Never use an index signature. If the API returns a new field, add it to the interface with the correct type.

### CSS
- All design tokens live as CSS custom properties on `[data-theme]` selectors in `styles.css`
- 6 theme variants: `light` (default), `dark`, plus 4 light sub-themes (`blueAccent`, `yellowBeige`, `mintSlate`, `blueModified`)
- Component styles use BEM-like class naming (`.result-row-cell`, `.filter-select-panel--grid`)
- Responsive breakpoints at 900px and 768px
- Prefer CSS classes over inline styles

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_HOST` | `localhost` | `opensearch` inside Docker; `localhost` outside |
| `OPENSEARCH_PORT` | `9200` | OpenSearch port |
| `OPENSEARCH_INDEX` | `project_data` | Index name |
| `DATA_FILE` | `2025_data.csv` | Path to data file (relative to working dir) |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Sentence-transformers model (384-d) |
| `EMBEDDING_DEVICE` | `auto` | `auto`, `cpu`, `cuda`, or `mps` |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend → backend base URL |

Copy `.env.example` → `.env` when running the backend directly (outside Docker).

## Known Gotchas

1. **Host difference:** `OPENSEARCH_HOST=opensearch` inside Docker (service name), `localhost` outside. Docker Compose sets this automatically; `.env.example` sets it for direct runs.
2. **Docker memory:** OpenSearch requires >= 4 GB allocated to Docker Desktop (Settings → Resources → Memory).
3. **Hardcoded index name:** `INDEX_NAME = "project_data"` appears in `search.py` and `analytics.py`. If you rename the index, update both files and the `OPENSEARCH_INDEX` env var.
4. **Double `get_client()`:** `indexer/index_data.py` defines its own `get_client()` that duplicates `api/opensearch_client.py`. They are functionally identical; `reindex.py` imports from `index_data.py`.
5. **Embedding model must match at index and query time.** Indexed vectors are 384-d from `all-MiniLM-L6-v2`. Do not switch to mpnet (768-d) without a full reindex.
6. **Pre-existing TypeScript errors (5).** Recharts type mismatches on `animationDuration` props, a missing `react-slider` type declaration, and a stale `React.HTMLElement` reference. These do not affect runtime behavior. Run `npx tsc --noEmit` to check.
7. **`useFilterCatalog` module-level cache** persists for the app's lifetime. In Vite dev mode, editing the file triggers a fresh fetch (correct behavior). The cache resets on fetch failure so the next mount retries.
8. **`prop-types` removed from package.json.** Run `npm install` in `frontend/` to clean `node_modules` if you see stale references.
