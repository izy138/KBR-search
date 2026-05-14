import { useEffect, useState } from "react";
import type { SearchResultRecord } from "../api";
import { getProjectById, searchSimilarToProjectId } from "../api";
import ResultsList from "./ResultsList";

type SemanticSimilarProjectPageProps = {
  projectId: string;
  onBackToLab: () => void;
  onOpenFullProject: (projectId: string) => void;
  /** Optional; kept for callers that support chaining similarity from another grant. */
  onOpenSimilarFor?: (projectId: string) => void;
  onOpenInvestigator?: (name: string) => void;
};

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
        setNeighbors(similarOutcome.value.results ?? []);
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
    <div className="semantic-similar-page">
      <button type="button" className="project-back-link" onClick={onBackToLab}>
        ← Vector search lab
      </button>

      <header className="semantic-similar-header">
        <h2 className="semantic-similar-title">Similar Projects</h2>
        
      </header>

      {anchorError ? <p className="semantic-lab-error">{anchorError}</p> : null}

      {anchor && !anchorError ? (
        <section className="semantic-anchor-card" aria-labelledby="anchor-h">
          
          <h3 className="semantic-anchor-title">{anchorTitle}</h3>
          <div className="semantic-hit-meta semantic-anchor-meta">
            <span className="tag activity">{anchorActivity}</span>
            <span className="tag fy">FY {anchorFy}</span>
            <span className="semantic-hit-ic">{anchor.IC_NAME ?? ""}</span>
          </div>
          <p className="semantic-anchor-org">{anchor.ORG_NAME ?? "—"}</p>
          <p className="semantic-anchor-cost">{formatUsd(anchor.TOTAL_COST as number | undefined)}</p>
          <div className="semantic-hit-actions">
            <button type="button" className="semantic-linkish" onClick={() => onOpenFullProject(projectId)}>
              Open full project page
            </button>
          </div>
        </section>
      ) : null}

      {similarError ? (
        <div className="semantic-lab-panel semantic-lab-panel-warn" role="alert">
          <p className="semantic-lab-error">{similarError}</p>
          {similarError.toLowerCase().includes("embedding") ? (
            <p className="semantic-lab-desc">
              This index row has no stored vector. Re-import NDJSON embeddings or reindex with
              embeddings so k-NN can run.
            </p>
          ) : null}
        </div>
      ) : null}

      {showResultsTable ? (
        <section className="semantic-similar-results-block" aria-labelledby="similar-results-h">
          <h2 id="similar-results-h" className="semantic-lab-h2 semantic-similar-results-heading">
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
        <p className="semantic-lab-meta">No neighbors returned (unexpected for a valid embedded project).</p>
      ) : null}
    </div>
  );
}
