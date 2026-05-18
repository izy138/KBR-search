import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type HybridSearchResponse,
  type SearchResultRecord,
  type SimilarSearchResponse,
  searchHybrid,
  searchProjects,
  searchSimilarByText,
} from "../../api";
import { formatDollarsFull } from "../../utils/format";

const DEFAULT_K = 12;
const PICK_SEARCH_LIMIT = 12;

const CLS_PANEL = "bg-surface border border-border rounded-lg px-[1.35rem] pt-[1.25rem] pb-[1.4rem] mb-[1.25rem] shadow-sm";
const CLS_H2 = "text-[0.95rem] font-semibold text-text-primary mb-[0.4rem]";
const CLS_DESC = "mb-4 text-[0.875rem] leading-[1.5] text-text-secondary";
const CLS_INLINE_CODE = "font-mono text-[0.78rem] bg-tag-bg text-tag-text px-[0.35rem] py-[0.12rem] rounded-sm";
const CLS_FORM = "flex flex-col gap-2";
const CLS_LABEL = "text-[0.78rem] font-medium uppercase tracking-[0.04em] text-text-muted";
const CLS_ROW = "flex flex-wrap gap-[0.6rem] items-center";
const CLS_INPUT = "flex-1 min-w-[180px] px-[0.75rem] py-[0.55rem] border border-border rounded-sm bg-bg text-text-primary font-sans text-[0.9375rem]";
const CLS_TEXTAREA = "w-full px-[0.75rem] py-[0.6rem] border border-border rounded-sm bg-bg text-text-primary font-sans text-[0.9375rem] leading-[1.45] resize-y";
const CLS_BTN = "px-4 py-[0.55rem] border-none rounded-sm bg-accent text-white font-sans text-[0.9rem] font-medium cursor-pointer hover:brightness-105 disabled:opacity-65 disabled:cursor-not-allowed";
const CLS_BTN_SECONDARY = "px-4 py-[0.55rem] border-none rounded-sm bg-text-secondary text-white font-sans text-[0.9rem] font-medium cursor-pointer hover:brightness-105 disabled:opacity-65 disabled:cursor-not-allowed";
const CLS_ERROR = "mt-2 text-[0.875rem] text-[#b91c1c] dark:text-[#fca5a5]";
const CLS_META = "mt-3 mb-[0.35rem] text-[0.8125rem] text-text-muted";
const CLS_PICK_ROW = "flex w-full items-center justify-between gap-4 px-4 py-[0.85rem] border-none border-b border-border bg-surface text-left cursor-pointer font-[inherit] last:border-b-0 hover:bg-surface-hover";
const CLS_HIT_TITLE = "text-[0.9375rem] font-medium text-text-primary leading-[1.35] mb-[0.35rem]";
const CLS_HIT_META = "flex flex-wrap gap-[0.35rem_0.5rem] items-center text-[0.78rem] text-text-secondary";
const CLS_RANKED_ITEM = "border border-border rounded-md p-[0.85rem_1rem] mb-2 bg-bg";
const CLS_RANK_BADGE = "inline-flex items-center justify-center min-w-[1.65rem] h-[1.65rem] rounded-sm bg-accent-light text-accent-text text-[0.75rem] font-semibold";
const CLS_LINKISH = "p-0 border-none bg-transparent text-accent font-[inherit] text-[0.8125rem] font-medium cursor-pointer underline underline-offset-2 hover:text-accent-text";

function ResultSnippet({ item }: { item: SearchResultRecord }): JSX.Element {
  const id = item._id ?? item.id ?? "";
  const title = item.PROJECT_TITLE ?? "Untitled";
  return (
    <div className="min-w-0">
      <div className={CLS_HIT_TITLE}>{title}</div>
      <div className={CLS_HIT_META}>
        {item.ACTIVITY ? <span className="inline-block px-[0.42rem] py-[0.12rem] rounded-full text-[0.72rem] font-semibold leading-[1.3] bg-accent-light text-accent-text">{item.ACTIVITY}</span> : null}
        {item.FY != null ? <span className="inline-block px-[0.42rem] py-[0.12rem] rounded-full text-[0.72rem] font-semibold leading-[1.3] bg-green-light text-green">FY {item.FY}</span> : null}
        {item.IC_NAME ? <span className="text-text-muted">{item.IC_NAME}</span> : null}
      </div>
      {id ? (
        <code className="block mt-[0.35rem] text-[0.7rem] text-text-muted break-all">{id}</code>
      ) : null}
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
    <div className="max-w-[880px] mx-auto px-0 pt-2 pb-10">
      <header className="mb-[1.75rem]">
        <h1 className="text-[1.65rem] font-semibold text-text-primary mt-0 mb-2 tracking-[-0.02em]">
          Vector search lab
        </h1>
        <p className="m-0 text-[0.98rem] leading-[1.55] text-text-secondary">
          These demos call the backend endpoints that use indexed sentence embeddings (384-d cosine
          space). Use them to explore semantic nearest neighbors, then open a grant for the full
          detail view.
        </p>
      </header>

      <section className={CLS_PANEL} aria-labelledby="pick-heading">
        <h2 id="pick-heading" className={CLS_H2}>
          1 — Pick a project, then see similar grants
        </h2>
        <p className={CLS_DESC}>
          Keyword-search for a grant, choose one row, and open a dedicated page that lists the top{" "}
          <em>k</em> embeddings most like that document (
          <code className={CLS_INLINE_CODE}>GET /search/similar/{"{project_id}"}</code>
          ).
        </p>
        <form className={CLS_FORM} onSubmit={handlePickSearch}>
          <label className={CLS_LABEL} htmlFor="pick-q">
            Find a project (keyword search)
          </label>
          <div className={CLS_ROW}>
            <input
              id="pick-q"
              className={CLS_INPUT}
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="e.g. Alzheimer tau imaging"
              autoComplete="off"
            />
            <button type="submit" className={CLS_BTN} disabled={pickLoading}>
              {pickLoading ? "Searching…" : "Find projects"}
            </button>
          </div>
        </form>
        {pickError ? <p className={CLS_ERROR}>{pickError}</p> : null}
        {pickResults.length > 0 ? (
          <ul className="list-none mt-3 p-0 border border-border rounded-md overflow-hidden">
            {pickResults.map((item) => {
              const id = item._id ?? item.id;
              if (!id) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={CLS_PICK_ROW}
                    onClick={() => goSimilarPage(id)}
                  >
                    <ResultSnippet item={item} />
                    <span className="flex-shrink-0 text-[0.8125rem] font-medium text-accent">
                      Similar grants →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <form
          className={`${CLS_FORM} mt-[1.25rem] pt-[1.1rem] border-t border-border`}
          onSubmit={handlePasteSubmit}
        >
          <label className={CLS_LABEL} htmlFor="paste-id">
            Or paste OpenSearch <code className={CLS_INLINE_CODE}>_id</code>
          </label>
          <div className={CLS_ROW}>
            <input
              id="paste-id"
              className={`${CLS_INPUT} font-mono text-[0.8125rem]`}
              value={pasteId}
              onChange={(e) => setPasteId(e.target.value)}
              placeholder="document _id from URL /projects/…"
              autoComplete="off"
            />
            <button type="submit" className={CLS_BTN_SECONDARY}>
              Open similar page
            </button>
          </div>
        </form>
        {pasteError ? <p className={CLS_ERROR}>{pasteError}</p> : null}
      </section>

      <section className={CLS_PANEL} aria-labelledby="sim-text-heading">
        <h2 id="sim-text-heading" className={CLS_H2}>
          2 — Semantic search from a sentence
        </h2>
        <p className={CLS_DESC}>
          The query is embedded with the same model used at index time; results are pure k-NN (
          <code className={CLS_INLINE_CODE}>GET /search/similar?q=…</code>
          ).
        </p>
        <form className={CLS_FORM} onSubmit={handleSemanticSubmit}>
          <label className={CLS_LABEL} htmlFor="sim-q">
            Describe the research you are looking for
          </label>
          <textarea
            id="sim-q"
            className={CLS_TEXTAREA}
            rows={3}
            value={simText}
            onChange={(e) => setSimText(e.target.value)}
          />
          <div className={`${CLS_ROW} justify-end mt-[0.35rem]`}>
            <label className="inline-flex items-center gap-[0.4rem]">
              <span className="text-[0.8125rem] text-text-secondary">k</span>
              <input
                type="number"
                className={`${CLS_INPUT} flex-[0_0_auto] min-w-[4.5rem] max-w-[5.5rem]`}
                min={1}
                max={50}
                value={simK}
                onChange={(e) => setSimK(Number.parseInt(e.target.value, 10) || 10)}
              />
            </label>
            <button type="submit" className={CLS_BTN} disabled={simLoading}>
              {simLoading ? "Embedding & searching…" : "Run semantic search"}
            </button>
          </div>
        </form>
        {simError ? <p className={CLS_ERROR}>{simError}</p> : null}
        {simResult ? (
          <div className="mt-2">
            <p className={CLS_META}>
              <strong>{simResult.results.length}</strong> hits (requested k = {simResult.k})
            </p>
            <ol className="list-none m-0 p-0">
              {simResult.results.map((item, index) => {
                const id = item._id ?? item.id ?? "";
                const score = typeof item._score === "number" ? item._score : null;
                return (
                  <li key={id || String(index)} className={CLS_RANKED_ITEM}>
                    <div className="flex flex-wrap items-center gap-[0.5rem_0.75rem] mb-2">
                      <span className={CLS_RANK_BADGE}>{index + 1}</span>
                      {score != null ? (
                        <span
                          className="font-mono text-[0.75rem] text-text-secondary"
                          title="OpenSearch k-NN score"
                        >
                          score {score.toFixed(4)}
                        </span>
                      ) : null}
                    </div>
                    <ResultSnippet item={item} />
                    {id ? (
                      <div className="flex flex-wrap gap-[0.75rem_1rem] mt-[0.65rem]">
                        <button
                          type="button"
                          className={CLS_LINKISH}
                          onClick={() => navigate(`/projects/${encodeURIComponent(id)}`)}
                        >
                          Full project
                        </button>
                        <button
                          type="button"
                          className={CLS_LINKISH}
                          onClick={() => goSimilarPage(id)}
                        >
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

      <section className={CLS_PANEL} aria-labelledby="hybrid-heading">
        <h2 id="hybrid-heading" className={CLS_H2}>
          3 — Hybrid keyword + vectors (RRF)
        </h2>
        <p className={CLS_DESC}>
          Runs BM25 and k-NN in parallel, then merges rankings with reciprocal rank fusion (
          <code className={CLS_INLINE_CODE}>GET /search/hybrid</code>
          ). Optional filters apply to <em>both</em> sides. Each hit shows fused score and its rank
          on each list when present.
        </p>
        <form className={CLS_FORM} onSubmit={handleHybridSubmit}>
          <label className={CLS_LABEL} htmlFor="hybrid-q">
            Query
          </label>
          <textarea
            id="hybrid-q"
            className={CLS_TEXTAREA}
            rows={2}
            value={hybridQ}
            onChange={(e) => setHybridQ(e.target.value)}
          />
          <div className="grid grid-cols-[140px_1fr] gap-[0.45rem_0.75rem] items-center mb-[0.35rem]">
            <label className={CLS_LABEL} htmlFor="hybrid-act">
              Activity (optional)
            </label>
            <input
              id="hybrid-act"
              className={CLS_INPUT}
              value={hybridActivity}
              onChange={(e) => setHybridActivity(e.target.value)}
              placeholder="e.g. R01"
            />
            <label className={CLS_LABEL} htmlFor="hybrid-st">
              State (optional)
            </label>
            <input
              id="hybrid-st"
              className={CLS_INPUT}
              value={hybridState}
              onChange={(e) => setHybridState(e.target.value)}
              placeholder="e.g. CA"
            />
            <label className={CLS_LABEL} htmlFor="hybrid-fymin">
              FY min
            </label>
            <input
              id="hybrid-fymin"
              className={CLS_INPUT}
              value={hybridFyMin}
              onChange={(e) => setHybridFyMin(e.target.value)}
              placeholder="2020"
            />
            <label className={CLS_LABEL} htmlFor="hybrid-fymax">
              FY max
            </label>
            <input
              id="hybrid-fymax"
              className={CLS_INPUT}
              value={hybridFyMax}
              onChange={(e) => setHybridFyMax(e.target.value)}
              placeholder="2025"
            />
          </div>
          <div className={`${CLS_ROW} justify-end mt-[0.35rem]`}>
            <label className="inline-flex items-center gap-[0.4rem]">
              <span className="text-[0.8125rem] text-text-secondary">k</span>
              <input
                type="number"
                className={`${CLS_INPUT} flex-[0_0_auto] min-w-[4.5rem] max-w-[5.5rem]`}
                min={1}
                max={50}
                value={hybridK}
                onChange={(e) => setHybridK(Number.parseInt(e.target.value, 10) || 10)}
              />
            </label>
            <button type="submit" className={CLS_BTN} disabled={hybridLoading}>
              {hybridLoading ? "Running hybrid…" : "Run hybrid search"}
            </button>
          </div>
        </form>
        {hybridError ? <p className={CLS_ERROR}>{hybridError}</p> : null}
        {hybridResult ? (
          <div className="mt-2">
            <p className={CLS_META}>
              BM25 total ≈ <strong>{hybridResult.keyword_total.toLocaleString()}</strong> · fetched{" "}
              {hybridResult.fetch_size_per_side} per side · returning top{" "}
              <strong>{hybridResult.results.length}</strong> fused
            </p>
            <ol className="list-none m-0 p-0">
              {hybridResult.results.map((item, index) => {
                const id = item._id ?? item.id ?? "";
                const fused =
                  typeof item._score === "number" ? item._score : Number(item._score) || null;
                const rk = item._rank_keyword;
                const rv = item._rank_vector;
                return (
                  <li key={id || String(index)} className={CLS_RANKED_ITEM}>
                    <div className="flex flex-wrap items-center gap-[0.5rem_0.75rem] mb-2">
                      <span className={CLS_RANK_BADGE}>{index + 1}</span>
                      {fused != null ? (
                        <span
                          className="font-mono text-[0.75rem] text-text-secondary"
                          title="RRF fused score"
                        >
                          RRF {fused.toFixed(5)}
                        </span>
                      ) : null}
                      <span className="text-[0.72rem] text-text-muted">
                        BM25 rank: {rk != null ? String(rk) : "—"} · Vector rank:{" "}
                        {rv != null ? String(rv) : "—"}
                      </span>
                    </div>
                    <ResultSnippet item={item} />
                    <div className={`${CLS_HIT_META} mt-[0.35rem] font-mono text-[0.8125rem]`}>
                      {formatDollarsFull(item.TOTAL_COST)}
                    </div>
                    {id ? (
                      <div className="flex flex-wrap gap-[0.75rem_1rem] mt-[0.65rem]">
                        <button
                          type="button"
                          className={CLS_LINKISH}
                          onClick={() => navigate(`/projects/${encodeURIComponent(id)}`)}
                        >
                          Full project
                        </button>
                        <button
                          type="button"
                          className={CLS_LINKISH}
                          onClick={() => goSimilarPage(id)}
                        >
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
