# PROJECT_TERMS statistics and filtering

NIH exports include **`PROJECT_TERMS`**: a semicolon-separated list of MeSH-style keywords on each grant. A small set of words appear on a huge share of projects (`research`, `data`, `human`, …). Those terms add little discriminative signal when building **embedding vectors**—every project looks slightly similar because they all mention the same boilerplate vocabulary.

This project can **measure** how common each term is across the corpus, then **strip overly common terms** before text is sent to the sentence-transformer model.

---

## Two related but different uses of PROJECT_TERMS

| Use | Script / code | Purpose |
| --- | ------------- | ------- |
| **Generic-term filter (embeddings)** | `term_stats.py` → `term_stats.json` → `embeddings.py` | Remove high-`df_ratio` terms before encoding grants |
| **Dashboard theme cloud** | `build_project_term_theme_counts.py` | Cluster terms into themes for the word cloud (separate pipeline) |

This page focuses on **generic-term filtering for embeddings**. Theme-cloud filtering is summarized at the end.

---

## Step 1 — Compute term statistics (`term_stats.py`)

The script scans one or more CSV files and tallies how often each normalized term appears **across documents**.

### How each term is counted

1. Read CSV in chunks (same 2,000-row chunks as the indexer).
2. For each row, read `PROJECT_TERMS`.
3. Split on **`;`**, trim whitespace, **lowercase** each piece (canonical form).
4. Build a **set per document** so a term listed twice on one grant only counts **once** toward that document’s frequency.
5. Increment a global document-frequency counter (`df`) for each term in that set.

From `df` the script also computes:

| Field | Formula | Meaning |
| ----- | ------- | ------- |
| `df` | raw count | Number of documents containing the term |
| `df_ratio` | `df / doc_count` | Fraction of the corpus (0.0–1.0) |
| `idf` | `log(doc_count / df)` | Inverse document frequency (informational; not used for filtering) |

The `terms` array in the output JSON is sorted by **`df` descending**, so the **most frequent (most generic) terms appear first** when you print or inspect the file.

### Output file: `term_stats.json`

Example structure:

```json
{
  "doc_count": 493578,
  "field": "PROJECT_TERMS",
  "separator": ";",
  "terms": [
    {"term": "data", "df": 291613, "df_ratio": 0.590814, "idf": 0.526253},
    {"term": "goals", "df": 287365, "df_ratio": 0.582208, "idf": 0.540928},
    {"term": "research", "df": 283803, "df_ratio": 0.574991, "idf": 0.553401}
  ]
}
```

On this repo’s multi-year corpus, the top terms include `data`, `goals`, `research`, `testing`, `development`—each appearing in **more than half** of all documents.

### Commands to generate stats

**Single year (Docker):**

```bash
docker compose exec backend python indexer/term_stats.py /app/2025_data.csv --output term_stats.json
```

**All years as one corpus (recommended if that is what you index):**

```bash
docker compose exec backend python indexer/term_stats.py \
  /app/2020_data.csv /app/2021_data.csv /app/2022_data.csv \
  /app/2023_data.csv /app/2024_data.csv /app/2025_data.csv \
  --output term_stats.json
```

**Print top N terms to the terminal:**

```bash
docker compose exec backend python indexer/term_stats.py /app/2025_data.csv --top 50
```

**Outside Docker** (from `backend/` with CSV paths on disk):

```bash
cd backend
python indexer/term_stats.py 2025_data.csv --output term_stats.json
```

The default output path is `term_stats.json` in the **current working directory**. The backend container’s working directory is `/app`, so the committed file lives at **`backend/term_stats.json`** when generated inside Docker.

**Regenerate when:** you add years to the corpus, refresh CSV exports, or change which files you consider “the corpus” for embedding.

---

## Step 2 — Filter at embedding time (`embeddings.py`)

When `build_text_for_record()` assembles text for the model, it concatenates:

1. `PROJECT_TITLE`
2. **Filtered** `PROJECT_TERMS`
3. `ABSTRACT_TEXT` (truncated)

Filtering is implemented in `_filter_terms_field()`:

```text
For each term in PROJECT_TERMS (split on ";"):
  normalize → lowercase + strip
  if term is in the "generic" set → drop it
  else → keep it (original casing in output joined with "; ")
```

### How the generic set is built

On first embed in a process, `get_generic_terms()` loads `term_stats.json` (if present) and marks every term where:

```text
df_ratio >= EMBEDDING_TERM_MAX_DF_RATIO
```

| Setting | Default | Meaning |
| ------- | ------- | ------- |
| `EMBEDDING_TERM_STATS_PATH` | `term_stats.json` | Path to the stats file (relative to process cwd, usually `/app` in Docker) |
| `EMBEDDING_TERM_MAX_DF_RATIO` | **0.20** (20%) | Terms appearing in ≥ 20% of documents are stripped |

**Example:** with default `0.20`, `research` at `df_ratio ≈ 0.57` is removed; a term that appears in only 5% of grants is kept.

The generic set is cached in memory for the lifetime of the API/indexer process. Startup logs include a line like:

```text
Loaded 12,345 generic terms from term_stats.json (df_ratio >= 0.20).
```

### Opt-in behavior

If **`term_stats.json` is missing**, `get_generic_terms()` returns an **empty set** and **no terms are filtered**. Embedding behaves as if this feature were off. Nothing breaks—you simply do not get the noise reduction until you generate the file.

### Where filtering applies

The same `build_text_for_record()` runs in:

- `index_data.py` / `append_data.py` (Docker `--with-embeddings`)
- `export_embeddings.py` (NDJSON pipeline)
- `embed_query()` at search time (query text is **not** run through PROJECT_TERMS filtering—only title/terms/abstract fields on **documents**)

After filtering, if every term on a row is generic, the `PROJECT_TERMS` portion is omitted entirely; title and abstract still embed.

---

## Tuning the threshold

| `EMBEDDING_TERM_MAX_DF_RATIO` | Effect |
| ----------------------------- | ------ |
| **Higher** (e.g. `0.50`) | Only extremely common terms removed; more terms left in embeddings |
| **Lower** (e.g. `0.10`) | Aggressive removal; more discriminative but risk dropping useful broad terms |
| **Default `0.20`** | Balance used in code comments: drops boilerplate without emptying most rows |

Change in `docker-compose.yml` or when running one-off commands:

```bash
docker compose exec -e EMBEDDING_TERM_MAX_DF_RATIO=0.25 backend \
  python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

**Important:** If you change stats or threshold, **re-embed or re-import** documents so stored vectors match the new text. Existing OpenSearch vectors are not updated automatically.

---

## End-to-end workflow

```text
CSV file(s)
  → term_stats.py
  → term_stats.json (sorted by df, terms with high df_ratio flagged at load)

CSV / NDJSON indexing or export
  → build_text_for_record()
      → split PROJECT_TERMS on ";"
      → drop terms where df_ratio >= threshold (from term_stats.json)
      → join remaining terms + title + abstract
  → sentence-transformer encode
  → OpenSearch document.embedding
```

Recommended order for a fresh environment:

```bash
# 1. Compute stats on the same CSVs you will index
docker compose exec backend python indexer/term_stats.py \
  /app/2020_data.csv /app/2021_data.csv /app/2022_data.csv \
  /app/2023_data.csv /app/2024_data.csv /app/2025_data.csv \
  --output term_stats.json

# 2. Index with embeddings (filtering picks up term_stats.json automatically)
docker compose exec backend python indexer/index_data.py /app/2025_data.csv --with-embeddings
```

---

## What is *not* filtered by term_stats

| Feature | Filtering |
| ------- | --------- |
| **Keyword search** (`GET /search/`) | Full `PROJECT_TERMS` in OpenSearch; BM25 uses raw indexed text |
| **Dashboard theme cloud** | Uses `project_term_theme_counts.json`, not `term_stats.json` |
| **Analytics** `by-activity-terms` | Aggregates raw `PROJECT_TERMS.keyword` in OpenSearch |
| **UI project detail** | Shows full semicolon-separated term list from the document |

Generic-term filtering affects **only the text fed to the embedding model**, not what users see in search results or term lists.

---

## Dashboard theme cloud (related)

`build_project_term_theme_counts.py` is a **separate** offline job:

1. Count every `PROJECT_TERMS` token across `indexer/data/*_data.csv` (mention frequency, not per-doc set).
2. Drop terms with fewer than **`--min-term-count`** hits (default `1`).
3. Truncate each term to **480 characters** before encoding.
4. Embed terms and fixed **category anchor** paragraphs.
5. Assign each term to the nearest anchor by cosine similarity; if similarity &lt; **0.18**, bucket as `Low_confidence`.
6. Write `backend/indexer/project_term_theme_counts.json` for `GET /analytics/project-term-theme-cloud`.

```bash
docker compose exec backend python indexer/build_project_term_theme_counts.py
```

That pipeline does **not** use `term_stats.json` or `EMBEDDING_TERM_MAX_DF_RATIO`.

---

## Key files

| File | Role |
| ---- | ---- |
| `backend/indexer/term_stats.py` | Build `term_stats.json` from CSV(s) |
| `backend/term_stats.json` | Committed/generated corpus statistics |
| `backend/api/embeddings.py` | `get_generic_terms()`, `_filter_terms_field()`, `build_text_for_record()` |
| `backend/indexer/build_project_term_theme_counts.py` | Theme cloud JSON (separate logic) |
