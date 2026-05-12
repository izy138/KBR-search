import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type HybridSearchResponse,
  type SearchResultRecord,
  type SimilarSearchResponse,
  searchHybrid,
  searchProjects,
  searchSimilarByText,
} from "../api";

const DEFAULT_K = 12;
const PICK_SEARCH_LIMIT = 12;

function formatUsd(n: number | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ResultSnippet({ item }: { item: SearchResultRecord }): JSX.Element {
  const id = item._id ?? item.id ?? "";
  const title = item.PROJECT_TITLE ?? "Untitled";
  return (
    <div className="semantic-hit-snippet">
      <div className="semantic-hit-title">{title}</div>
      <div className="semantic-hit-meta">
        {item.ACTIVITY ? <span className="tag activity">{item.ACTIVITY}</span> : null}
        {item.FY != null ? <span className="tag fy">FY {item.FY}</span> : null}
        {item.IC_NAME ? <span className="semantic-hit-ic">{item.IC_NAME}</span> : null}
      </div>
      {id ? <code className="semantic-hit-id">{id}</code> : null}
    </div>
  );
}

export default function SemanticVectorLabPage(): JSX.Element {
  const navigate = useNavigate();

  const [pickQuery, setPickQuery] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickResults, setPickResults] = useState<SearchResultRecord[]>([]);
  const [pickError, setPickError] = useState("");

  const [pasteId, setPasteId] = useState("");
  const [pasteError, setPasteError] = useState("");

  const [simText, setSimText] = useState("CRISPR base editing cardiovascular disease");
  const [simK, setSimK] = useState(DEFAULT_K);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimilarSearchResponse | null>(null);
  const [simError, setSimError] = useState("");

  const [hybridQ, setHybridQ] = useState("machine learning drug discovery biomarkers");
  const [hybridK, setHybridK] = useState(DEFAULT_K);
  const [hybridActivity, setHybridActivity] = useState("");
  const [hybridState, setHybridState] = useState("");
  const [hybridFyMin, setHybridFyMin] = useState("");
  const [hybridFyMax, setHybridFyMax] = useState("");
  const [hybridLoading, setHybridLoading] = useState(false);
  const [hybridResult, setHybridResult] = useState<HybridSearchResponse | null>(null);
  const [hybridError, setHybridError] = useState("");

  const goSimilarPage = (projectId: string) => {
    navigate(`/semantic/similar/${encodeURIComponent(projectId)}`);
  };

  const handlePickSearch = async (e: FormEvent) => {
    e.preventDefault();
    setPickError("");
    setPickResults([]);
    const q = pickQuery.trim();
    if (!q) {
      setPickError("Enter a few keywords to find a project.");
      return;
    }
    setPickLoading(true);
    try {
      const payload = await searchProjects(q, { limit: PICK_SEARCH_LIMIT, page: 1 });
      setPickResults(payload.results ?? []);
      if ((payload.results ?? []).length === 0) {
        setPickError("No projects matched. Try different keywords.");
      }
    } catch {
      setPickError("Search failed. Is the API running?");
    } finally {
      setPickLoading(false);
    }
  };

  const handlePasteSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasteError("");
    const id = pasteId.trim();
    if (!id) {
      setPasteError("Paste the OpenSearch document _id (same as in project URLs).");
      return;
    }
    goSimilarPage(id);
  };

  const handleSemanticSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSimError("");
    setSimResult(null);
    const q = simText.trim();
    if (!q) {
      setSimError("Enter a natural-language description.");
      return;
    }
    setSimLoading(true);
    try {
      const payload = await searchSimilarByText(q, simK);
      setSimResult(payload);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Semantic search failed.");
    } finally {
      setSimLoading(false);
    }
  };

  const handleHybridSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHybridError("");
    setHybridResult(null);
    const q = hybridQ.trim();
    if (!q) {
      setHybridError("Enter a query.");
      return;
    }
    setHybridLoading(true);
    try {
      const payload = await searchHybrid(q, {
        k: hybridK,
        activity: hybridActivity.trim(),
        state: hybridState.trim(),
        fyMin: hybridFyMin.trim(),
        fyMax: hybridFyMax.trim(),
      });
      setHybridResult(payload);
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "Hybrid search failed.");
    } finally {
      setHybridLoading(false);
    }
  };

  return (
    <div className="semantic-lab">
      <header className="semantic-lab-hero">
        <h1 className="semantic-lab-title">Vector search lab</h1>
        <p className="semantic-lab-lede">
          These demos call the backend endpoints that use indexed sentence embeddings (384-d cosine
          space). Use them to explore semantic nearest neighbors, then open a grant for the full
          detail view.
        </p>
      </header>

      <section className="semantic-lab-panel" aria-labelledby="pick-heading">
        <h2 id="pick-heading" className="semantic-lab-h2">
          1 — Pick a project, then see similar grants
        </h2>
        <p className="semantic-lab-desc">
          Keyword-search for a grant, choose one row, and open a dedicated page that lists the top{" "}
          <em>k</em> embeddings most like that document (
          <code className="semantic-inline-code">GET /search/similar/{"{project_id}"}</code>
          ).
        </p>
        <form className="semantic-lab-form" onSubmit={handlePickSearch}>
          <label className="semantic-lab-label" htmlFor="pick-q">
            Find a project (keyword search)
          </label>
          <div className="semantic-lab-row">
            <input
              id="pick-q"
              className="semantic-lab-input"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="e.g. Alzheimer tau imaging"
              autoComplete="off"
            />
            <button type="submit" className="semantic-lab-btn" disabled={pickLoading}>
              {pickLoading ? "Searching…" : "Find projects"}
            </button>
          </div>
        </form>
        {pickError ? <p className="semantic-lab-error">{pickError}</p> : null}
        {pickResults.length > 0 ? (
          <ul className="semantic-pick-list">
            {pickResults.map((item) => {
              const id = item._id ?? item.id;
              if (!id) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="semantic-pick-row"
                    onClick={() => goSimilarPage(id)}
                  >
                    <ResultSnippet item={item} />
                    <span className="semantic-pick-cta">Similar grants →</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <form className="semantic-lab-form semantic-lab-form-tight" onSubmit={handlePasteSubmit}>
          <label className="semantic-lab-label" htmlFor="paste-id">
            Or paste OpenSearch <code className="semantic-inline-code">_id</code>
          </label>
          <div className="semantic-lab-row">
            <input
              id="paste-id"
              className="semantic-lab-input semantic-lab-input-mono"
              value={pasteId}
              onChange={(e) => setPasteId(e.target.value)}
              placeholder="document _id from URL /projects/…"
              autoComplete="off"
            />
            <button type="submit" className="semantic-lab-btn semantic-lab-btn-secondary">
              Open similar page
            </button>
          </div>
        </form>
        {pasteError ? <p className="semantic-lab-error">{pasteError}</p> : null}
      </section>

      <section className="semantic-lab-panel" aria-labelledby="sim-text-heading">
        <h2 id="sim-text-heading" className="semantic-lab-h2">
          2 — Semantic search from a sentence
        </h2>
        <p className="semantic-lab-desc">
          The query is embedded with the same model used at index time; results are pure k-NN (
          <code className="semantic-inline-code">GET /search/similar?q=…</code>
          ).
        </p>
        <form className="semantic-lab-form" onSubmit={handleSemanticSubmit}>
          <label className="semantic-lab-label" htmlFor="sim-q">
            Describe the research you are looking for
          </label>
          <textarea
            id="sim-q"
            className="semantic-lab-textarea"
            rows={3}
            value={simText}
            onChange={(e) => setSimText(e.target.value)}
          />
          <div className="semantic-lab-row semantic-lab-row-end">
            <label className="semantic-lab-inline">
              <span className="semantic-lab-inline-label">k</span>
              <input
                type="number"
                className="semantic-lab-input semantic-lab-input-narrow"
                min={1}
                max={50}
                value={simK}
                onChange={(e) => setSimK(Number.parseInt(e.target.value, 10) || 10)}
              />
            </label>
            <button type="submit" className="semantic-lab-btn" disabled={simLoading}>
              {simLoading ? "Embedding & searching…" : "Run semantic search"}
            </button>
          </div>
        </form>
        {simError ? <p className="semantic-lab-error">{simError}</p> : null}
        {simResult ? (
          <div className="semantic-results-block">
            <p className="semantic-lab-meta">
              <strong>{simResult.results.length}</strong> hits (requested k = {simResult.k})
            </p>
            <ol className="semantic-ranked-list">
              {simResult.results.map((item, index) => {
                const id = item._id ?? item.id ?? "";
                const score = typeof item._score === "number" ? item._score : null;
                return (
                  <li key={id || String(index)} className="semantic-ranked-item">
                    <div className="semantic-ranked-head">
                      <span className="semantic-rank-badge">{index + 1}</span>
                      {score != null ? (
                        <span className="semantic-score" title="OpenSearch k-NN score">
                          score {score.toFixed(4)}
                        </span>
                      ) : null}
                    </div>
                    <ResultSnippet item={item} />
                    {id ? (
                      <div className="semantic-hit-actions">
                        <button
                          type="button"
                          className="semantic-linkish"
                          onClick={() => navigate(`/projects/${encodeURIComponent(id)}`)}
                        >
                          Full project
                        </button>
                        <button type="button" className="semantic-linkish" onClick={() => goSimilarPage(id)}>
                          Similar to this grant
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </section>

      <section className="semantic-lab-panel" aria-labelledby="hybrid-heading">
        <h2 id="hybrid-heading" className="semantic-lab-h2">
          3 — Hybrid keyword + vectors (RRF)
        </h2>
        <p className="semantic-lab-desc">
          Runs BM25 and k-NN in parallel, then merges rankings with reciprocal rank fusion (
          <code className="semantic-inline-code">GET /search/hybrid</code>
          ). Optional filters apply to <em>both</em> sides. Each hit shows fused score and its rank
          on each list when present.
        </p>
        <form className="semantic-lab-form" onSubmit={handleHybridSubmit}>
          <label className="semantic-lab-label" htmlFor="hybrid-q">
            Query
          </label>
          <textarea
            id="hybrid-q"
            className="semantic-lab-textarea"
            rows={2}
            value={hybridQ}
            onChange={(e) => setHybridQ(e.target.value)}
          />
          <div className="semantic-lab-filter-grid">
            <label className="semantic-lab-label" htmlFor="hybrid-act">
              Activity (optional)
            </label>
            <input
              id="hybrid-act"
              className="semantic-lab-input"
              value={hybridActivity}
              onChange={(e) => setHybridActivity(e.target.value)}
              placeholder="e.g. R01"
            />
            <label className="semantic-lab-label" htmlFor="hybrid-st">
              State (optional)
            </label>
            <input
              id="hybrid-st"
              className="semantic-lab-input"
              value={hybridState}
              onChange={(e) => setHybridState(e.target.value)}
              placeholder="e.g. CA"
            />
            <label className="semantic-lab-label" htmlFor="hybrid-fymin">
              FY min
            </label>
            <input
              id="hybrid-fymin"
              className="semantic-lab-input"
              value={hybridFyMin}
              onChange={(e) => setHybridFyMin(e.target.value)}
              placeholder="2020"
            />
            <label className="semantic-lab-label" htmlFor="hybrid-fymax">
              FY max
            </label>
            <input
              id="hybrid-fymax"
              className="semantic-lab-input"
              value={hybridFyMax}
              onChange={(e) => setHybridFyMax(e.target.value)}
              placeholder="2025"
            />
          </div>
          <div className="semantic-lab-row semantic-lab-row-end">
            <label className="semantic-lab-inline">
              <span className="semantic-lab-inline-label">k</span>
              <input
                type="number"
                className="semantic-lab-input semantic-lab-input-narrow"
                min={1}
                max={50}
                value={hybridK}
                onChange={(e) => setHybridK(Number.parseInt(e.target.value, 10) || 10)}
              />
            </label>
            <button type="submit" className="semantic-lab-btn" disabled={hybridLoading}>
              {hybridLoading ? "Running hybrid…" : "Run hybrid search"}
            </button>
          </div>
        </form>
        {hybridError ? <p className="semantic-lab-error">{hybridError}</p> : null}
        {hybridResult ? (
          <div className="semantic-results-block">
            <p className="semantic-lab-meta">
              BM25 total ≈ <strong>{hybridResult.keyword_total.toLocaleString()}</strong> · fetched{" "}
              {hybridResult.fetch_size_per_side} per side · returning top{" "}
              <strong>{hybridResult.results.length}</strong> fused
            </p>
            <ol className="semantic-ranked-list">
              {hybridResult.results.map((item, index) => {
                const id = item._id ?? item.id ?? "";
                const fused =
                  typeof item._score === "number" ? item._score : Number(item._score) || null;
                const rk = item._rank_keyword;
                const rv = item._rank_vector;
                return (
                  <li key={id || String(index)} className="semantic-ranked-item">
                    <div className="semantic-ranked-head">
                      <span className="semantic-rank-badge">{index + 1}</span>
                      {fused != null ? (
                        <span className="semantic-score" title="RRF fused score">
                          RRF {fused.toFixed(5)}
                        </span>
                      ) : null}
                      <span className="semantic-rrf-ranks">
                        BM25 rank: {rk != null ? String(rk) : "—"} · Vector rank:{" "}
                        {rv != null ? String(rv) : "—"}
                      </span>
                    </div>
                    <ResultSnippet item={item} />
                    <div className="semantic-hit-meta semantic-hit-funding">
                      {formatUsd(item.TOTAL_COST as number | undefined)}
                    </div>
                    {id ? (
                      <div className="semantic-hit-actions">
                        <button
                          type="button"
                          className="semantic-linkish"
                          onClick={() => navigate(`/projects/${encodeURIComponent(id)}`)}
                        >
                          Full project
                        </button>
                        <button type="button" className="semantic-linkish" onClick={() => goSimilarPage(id)}>
                          Similar to this grant
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
}
