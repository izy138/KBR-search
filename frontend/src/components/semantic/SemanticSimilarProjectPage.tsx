import { useEffect, useState } from "react";
import type { SearchResultRecord } from "../../api";
import { getProjectById, searchSimilarToProjectId } from "../../api";
import { groupSimilarNeighbors } from "../../utils/recurrenceGrouping";
import ResultsList from "../search/ResultsList";

type SemanticSimilarProjectPageProps = {
  projectId: string;
  onBackToLab: () => void;
  onOpenFullProject: (projectId: string) => void;
  /** Optional; kept for callers that support chaining similarity from another grant. */
  onOpenSimilarFor?: (projectId: string) => void;
  onOpenInvestigator?: (name: string) => void;
};

const CLS_LINKISH =
  "p-0 border-none bg-transparent text-accent font-[inherit] text-[0.8125rem] font-medium cursor-pointer underline underline-offset-2 hover:text-accent-text";
const CLS_ERROR = "mt-2 text-[0.875rem] text-[#b91c1c] dark:text-[#fca5a5]";
const CLS_HIT_META =
  "flex flex-wrap gap-[0.35rem_0.5rem] items-center text-[0.78rem] text-text-secondary";

/** API allows up to 50 neighbors; full page uses the same table layout as search. */
const SIMILAR_FULL_PAGE_K = 50;

function formatUsd(n: number | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SemanticSimilarProjectPage({
  projectId,
  onBackToLab,
  onOpenFullProject,
  onOpenInvestigator,
}: SemanticSimilarProjectPageProps): JSX.Element {
  const [anchor, setAnchor] = useState<SearchResultRecord | null>(null);
  const [neighbors, setNeighbors] = useState<SearchResultRecord[]>([]);
  const [anchorError, setAnchorError] = useState("");
  const [similarError, setSimilarError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAnchorError("");
    setSimilarError("");
    setAnchor(null);
    setNeighbors([]);

    void (async () => {
      const [projectOutcome, similarOutcome] = await Promise.allSettled([
        getProjectById(projectId),
        searchSimilarToProjectId(projectId, SIMILAR_FULL_PAGE_K),
      ]);
      if (cancelled) return;

      if (projectOutcome.status === "fulfilled") {
        setAnchor(projectOutcome.value);
      } else {
        setAnchor(null);
        setAnchorError("No project exists with this id, or the API is unreachable.");
      }

      if (similarOutcome.status === "fulfilled") {
        setNeighbors(groupSimilarNeighbors(similarOutcome.value.results ?? []));
      } else {
        const reason = similarOutcome.reason;
        const msg = reason instanceof Error ? reason.message : "Similarity search failed.";
        setSimilarError(msg);
        setNeighbors([]);
      }

      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const anchorTitle = anchor?.PROJECT_TITLE ?? "Project";
  const anchorActivity = anchor?.ACTIVITY ?? "—";
  const anchorFy = anchor?.FY != null ? String(anchor.FY) : "—";

  const handleOpenFromRow = (item: SearchResultRecord): void => {
    const id = item._id ?? item.id;
    if (typeof id === "string" && id.length > 0) {
      onOpenFullProject(id);
    }
  };

  const showResultsTable = !similarError && (loading || neighbors.length > 0);

  return (
    <div className="w-full max-w-none m-0 pt-[0.35rem] pb-10">
      <div className="mb-3">
        <button type="button" className="inline-block p-0 border-none bg-transparent text-accent font-sans text-[15.5px] cursor-pointer hover:underline" onClick={onBackToLab}>
          ← Vector search lab
        </button>
      </div>

      <header className="mt-2 mb-4">
        <h2 className="text-[1.45rem] font-semibold m-0 mb-[0.35rem] text-text-primary">Similar Projects</h2>
      </header>

      {anchorError ? <p className={CLS_ERROR}>{anchorError}</p> : null}

      {anchor && !anchorError ? (
        <section
          className="bg-surface border border-border rounded-lg p-[1.1rem_1.25rem] mb-6 shadow-sm"
          aria-labelledby="anchor-h"
        >
          <h3 className="text-[1.1rem] font-semibold mt-[0.35rem] mb-2 leading-[1.35] text-text-primary">
            {anchorTitle}
          </h3>
          <div className={`${CLS_HIT_META} mb-[0.35rem]`}>
            <span className="inline-block px-[0.42rem] py-[0.12rem] rounded-full text-[0.72rem] font-semibold leading-[1.3] bg-accent-light text-accent-text">{anchorActivity}</span>
            <span className="inline-block px-[0.42rem] py-[0.12rem] rounded-full text-[0.72rem] font-semibold leading-[1.3] bg-green-light text-green">FY {anchorFy}</span>
            <span className="text-text-muted">{anchor.IC_NAME ?? ""}</span>
          </div>
          <p className="m-0 mb-1 text-[0.875rem] text-text-secondary">{anchor.ORG_NAME ?? "—"}</p>
          <p className="m-0 font-mono text-[0.875rem] text-text-primary">{formatUsd(anchor.TOTAL_COST)}</p>
          <div className="flex flex-wrap gap-[0.75rem_1rem] mt-[0.65rem]">
            <button type="button" className={CLS_LINKISH} onClick={() => onOpenFullProject(projectId)}>
              Open full project page
            </button>
          </div>
        </section>
      ) : null}

      {similarError ? (
        <div
          className="bg-surface border border-border-strong rounded-lg p-[1.25rem_1.35rem_1.4rem] mb-5 shadow-sm"
          role="alert"
        >
          <p className={CLS_ERROR}>{similarError}</p>
          {similarError.toLowerCase().includes("embedding") ? (
            <p className="m-0 mb-4 text-[0.875rem] leading-[1.5] text-text-secondary">
              This index row has no stored vector. Re-import NDJSON embeddings or reindex with
              embeddings so k-NN can run.
            </p>
          ) : null}
        </div>
      ) : null}

      {showResultsTable ? (
        <section className="mt-5 w-full min-w-0" aria-labelledby="similar-results-h">
          <h2 id="similar-results-h" className="text-[0.95rem] font-semibold text-text-primary m-0 mb-2">
            {loading ? "Loading similar grants…" : `${neighbors.length} Similar Projects`}
          </h2>
          <ResultsList
            results={neighbors}
            primarySort="relevant"
            loading={loading}
            onOpenDetails={handleOpenFromRow}
            onOpenInvestigator={onOpenInvestigator}
          />
        </section>
      ) : null}

      {!loading && !similarError && anchor && neighbors.length === 0 ? (
        <p className="mt-3 mb-[0.35rem] text-[0.8125rem] text-text-muted">
          No neighbors returned (unexpected for a valid embedded project).
        </p>
      ) : null}
    </div>
  );
}
