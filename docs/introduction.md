# KBR Internship

This project is a full-stack NIH grant explorer built for local development and analysis.

## Stack

| Layer | Technology | Port |
| ----- | ---------- | ---- |
| Frontend | React + TypeScript + Vite | 5173 |
| Backend | Python + FastAPI | 8000 |
| Search | OpenSearch | 9200 |

## What it does

- **Search** NIH project records with full-text, vector similarity, and hybrid retrieval.
- **Analyze** funding by state, institute, activity type, organization, and more.
- **Explore** projects through a React dashboard with charts and a U.S. state map.

## Architecture

```text
[CSV data] → [Python indexer] → [OpenSearch]
                                      ↑
[React UI] ← [FastAPI API] ←──────────┘
```

The frontend only talks to FastAPI. FastAPI queries OpenSearch; React never connects to OpenSearch directly.

## Next steps

See [Getting Started](/getting-started) to run the stack locally, load data, and verify the API.
