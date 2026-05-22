import { type FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type HybridSearchResponse,
  type SearchResultRecord,
  searchHybrid,
} from "../../api";
import { useFilterCatalog } from "../../hooks/useFilterCatalog";
import Filters from "../search/Filters";
import { emptyFilterValues, type FilterValues } from "../../types/filters";
import { formatDollarsFull } from "../../utils/format";
import {
  HELP_SEARCH_FILTER_ACTIVITY,
  HELP_SEARCH_FILTER_FY,
  HELP_SEARCH_FILTER_IC,
  HELP_SEARCH_FILTER_ORG,
  HELP_SEARCH_FILTER_PI,
  HELP_SEARCH_FILTER_STATE,
} from "../../utils/helpContent";
import { cn } from "../../utils/cn";

const DEFAULT_K = 12;

const CLS_H2 = "text-[0.95rem] font-semibold text-text-primary mb-[0.4rem]";
const CLS_DESC = "mb-4 text-[0.875rem] leading-[1.5] text-text-secondary";
const CLS_INLINE_CODE = "font-mono text-[0.78rem] bg-tag-bg text-tag-text px-[0.35rem] py-[0.12rem] rounded-sm";
const CLS_K_INPUT =
  "w-[3.25rem] px-[0.5rem] py-[0.28rem] border border-border rounded-sm bg-bg font-sans text-[11px] text-text-primary outline-none transition-[border-color] duration-150 hover:border-border-strong focus:border-accent";
const CLS_SEARCH_ROW = "flex min-h-[5.25rem] min-w-0 items-start px-3 pt-3 pb-2";
const CLS_TYPING_BOX =
  "flex w-full max-w-[720px] mx-auto flex-col rounded-md border-2 border-accent-text/60 bg-bg transition-[border-color,box-shadow] duration-150 hover:border-accent-text/90 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(26,86,219,0.1)]";
const CLS_FOOTER_ROW =
  "flex flex-wrap items-center justify-between gap-2 border-t border-border px-2.5 py-1";
const CLS_ERROR = "mt-2 text-[0.875rem] text-[#b91c1c] dark:text-[#fca5a5]";
const CLS_META = "mt-3 mb-[0.35rem] text-[0.8125rem] text-text-muted";
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
  const filterCatalog = useFilterCatalog();

  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(emptyFilterValues);
  const [hybridQ, setHybridQ] = useState("machine learning drug discovery biomarkers");
  const [hybridKInput, setHybridKInput] = useState(String(DEFAULT_K));
  const [hybridLoading, setHybridLoading] = useState(false);
  const [hybridResult, setHybridResult] = useState<HybridSearchResponse | null>(null);
  const [hybridError, setHybridError] = useState("");

  const goSimilarPage = (projectId: string) => {
    navigate(`/semantic/similar/${encodeURIComponent(projectId)}`);
  };

  const handleClearFilters = useCallback(() => {
    setAppliedFilters(emptyFilterValues());
  }, []);

  const handleHybridSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHybridError("");
    setHybridResult(null);
    const q = hybridQ.trim();
    if (!q) {
      setHybridError("Enter a query.");
      return;
    }
    const kParsed = Number.parseInt(hybridKInput.trim(), 10);
    const k =
      Number.isFinite(kParsed) && kParsed >= 1 && kParsed <= 50 ? kParsed : DEFAULT_K;
    if (k !== kParsed) {
      setHybridKInput(String(k));
    }

    setHybridLoading(true);
    try {
      const payload = await searchHybrid(q, {
        k,
        pi: appliedFilters.pi,
        ic: appliedFilters.ic,
        org: appliedFilters.org,
        activity: appliedFilters.activity,
        state: appliedFilters.state,
        fyMin: appliedFilters.fyMin,
        fyMax: appliedFilters.fyMax,
      });
      setHybridResult(payload);
    } catch (err) {
      setHybridError(err instanceof Error ? err.message : "Hybrid search failed.");
    } finally {
      setHybridLoading(false);
    }
  };

  const hybridSearchSlot = (
    <form className="w-full min-w-0" onSubmit={handleHybridSubmit}>
      <div className={CLS_TYPING_BOX}>
        <div className={CLS_SEARCH_ROW}>
          <textarea
            id="hybrid-q"
            className="min-h-[3.75rem] min-w-0 w-full flex-1 resize-none border-none bg-transparent font-sans text-[14px] leading-[1.45] text-text-primary outline-none placeholder:text-text-muted"
            rows={3}
            value={hybridQ}
            onChange={(e) => setHybridQ(e.target.value)}
            placeholder="Describe the research you are looking for…"
            aria-label="Hybrid search query"
          />
        </div>
        <div className={CLS_FOOTER_ROW}>
          <div className="flex flex-wrap items-center gap-[0.45rem]">
            <label
              className="text-[0.65rem] font-medium uppercase tracking-[0.04em] text-text-muted"
              htmlFor="hybrid-k"
            >
              Number of Results
            </label>
            <input
              id="hybrid-k"
              type="text"
              inputMode="numeric"
              className={CLS_K_INPUT}
              value={hybridKInput}
              onChange={(e) => setHybridKInput(e.target.value.replace(/[^\d]/g, ""))}
              aria-label="Number of results"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-sm border-none bg-accent px-[0.65rem] py-[0.28rem] font-sans text-[11px] font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-65"
            disabled={hybridLoading}
          >
            {hybridLoading ? "Running hybrid…" : "Run hybrid search"}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="w-full px-0 pt-2 pb-10">
      <header className="mb-4 px-1">
        <h2 className={CLS_H2}>Hybrid keyword + vectors (RRF)</h2>
        <p className={CLS_DESC}>
          Runs BM25 and k-NN in parallel, then merges rankings with reciprocal rank fusion (
          <code className={CLS_INLINE_CODE}>GET /search/hybrid</code>
          ). Optional filters apply to <em>both</em> sides. Each hit shows fused score and its rank
          on each list when present.
        </p>
      </header>

      {filterCatalog ? (
        <Filters
          applied={appliedFilters}
          catalog={filterCatalog}
          onApply={setAppliedFilters}
          onClear={handleClearFilters}
          searchSlot={hybridSearchSlot}
          fieldHelp={{
            pi: HELP_SEARCH_FILTER_PI,
            ic: HELP_SEARCH_FILTER_IC,
            org: HELP_SEARCH_FILTER_ORG,
            activity: HELP_SEARCH_FILTER_ACTIVITY,
            state: HELP_SEARCH_FILTER_STATE,
            fy: HELP_SEARCH_FILTER_FY,
          }}
        />
      ) : (
        <p className="text-[0.875rem] text-text-muted px-1" role="status">
          Loading filters…
        </p>
      )}

      {hybridError ? <p className={cn(CLS_ERROR, "px-1")}>{hybridError}</p> : null}
      {hybridResult ? (
        <div className="mt-4 px-1">
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
    </div>
  );
}
