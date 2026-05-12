import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResultRecord } from "../api";
import { searchSimilarToProjectId } from "../api";
import { getOrderedPiNames } from "../utils/piNames";
import ProjectActivityTermsChart from "./ProjectActivityTermsChart";

type ProjectDetailsPageProps = {
  item: SearchResultRecord;
  onBack: () => void;
  onOpenInvestigator?: (name: string) => void;
  onOpenDetails?: (item: SearchResultRecord) => void;
};

const ABSTRACT_PREVIEW_LENGTH = 1500;
const SIMILAR_PANEL_K = 10;

function parseSemicolonTerms(rawTerms: string | undefined): string[] {
  if (!rawTerms) return [];
  return rawTerms
    .split(";")
    .map((term) => term.trim())
    .filter(Boolean);
}

function formatCurrency(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLocation(item: SearchResultRecord): string {
  const segments: string[] = [];
  if (item.ORG_CITY) segments.push(item.ORG_CITY);
  if (item.ORG_STATE) segments.push(item.ORG_STATE);
  if (item.ORG_ZIPCODE) segments.push(item.ORG_ZIPCODE);
  if (item.ORG_COUNTRY) segments.push(item.ORG_COUNTRY);
  return segments.join(", ") || "—";
}

function getProjectAbstract(item: SearchResultRecord): string | null {
  const abstractValue = item.ABSTRACT_TEXT ?? item.PROJECT_ABSTRACT ?? item.abstract;
  if (typeof abstractValue !== "string") return null;
  const normalized = abstractValue
    .replace(/^ABSTRACT\s*\n?/i, "")
    .replace(
      /^\s*project\s+summary(?:\s*\/\s*abstract)?\s*[:\-]?\s*(?:\r?\n)?/i,
      "",
    )
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n(?!\n)/g, "$1 ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

export default function ProjectDetailsPage({
  item,
  onBack,
  onOpenInvestigator,
  onOpenDetails,
}: ProjectDetailsPageProps) {
  const navigate = useNavigate();
  const piNames = getOrderedPiNames(item.PI_NAMEs);
  const projectTerms = parseSemicolonTerms(item.PROJECT_TERMS);
  const projectAbstract = getProjectAbstract(item);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState<boolean>(false);
  const fiscalYears = item.FY != null ? String(item.FY) : "—";
  const projectDates = [item.PROJECT_START, item.PROJECT_END].filter(Boolean).join(" to ") || "—";
  const activityId = typeof item.ACTIVITY === "string" ? item.ACTIVITY.trim() : "";
  const projectId = typeof item._id === "string" ? item._id : typeof item.id === "string" ? item.id : "";
  const [similarNeighbors, setSimilarNeighbors] = useState<SearchResultRecord[]>([]);
  const [similarLoading, setSimilarLoading] = useState<boolean>(false);
  const [similarError, setSimilarError] = useState<string>("");
  const isLongAbstract =
    projectAbstract != null && projectAbstract.length > ABSTRACT_PREVIEW_LENGTH;
  const abstractPreview =
    projectAbstract != null && isLongAbstract
      ? `${projectAbstract.slice(0, ABSTRACT_PREVIEW_LENGTH).trimEnd()}...`
      : projectAbstract;

  useEffect(() => {
    setIsAbstractExpanded(false);
  }, [item._id, item.APPLICATION_ID, item.PROJECT_TITLE]);

  useEffect(() => {
    if (!projectId) {
      setSimilarNeighbors([]);
      setSimilarError("");
      setSimilarLoading(false);
      return;
    }
    let cancelled = false;
    setSimilarLoading(true);
    setSimilarError("");
    setSimilarNeighbors([]);
    void (async () => {
      try {
        const payload = await searchSimilarToProjectId(projectId, SIMILAR_PANEL_K);
        if (!cancelled) {
          setSimilarNeighbors(payload.results ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Similarity search failed.";
          setSimilarError(msg);
          setSimilarNeighbors([]);
        }
      } finally {
        if (!cancelled) {
          setSimilarLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="project-details-layout">
    <div className="project-details-card">
      <div className="project-details-top-row">
        <button type="button" className="project-back-link" onClick={onBack}>
          Back to results
        </button>
        {projectId ? (
          <button
            type="button"
            className="project-vector-link"
            onClick={() => navigate(`/semantic/similar/${encodeURIComponent(projectId)}`)}
          >
            Similar grants (vectors)
          </button>
        ) : null}
      </div>

      <h1 className="project-details-title">{item.PROJECT_TITLE ?? "Untitled Project"}</h1>

      <section className="project-details-section">
        <h2>Project Abstract</h2>
        <p className={projectAbstract ? "project-details-abstract" : "project-details-placeholder"}>
          {projectAbstract == null
            ? "No abstract available for this project."
            : isAbstractExpanded
            ? projectAbstract
            : abstractPreview}
        </p>
        {projectAbstract != null && isLongAbstract && (
          <button
            type="button"
            className="project-details-abstract-toggle"
            onClick={() => setIsAbstractExpanded((prev) => !prev)}
          >
            {isAbstractExpanded ? "Show less" : "Read more"}
          </button>
        )}
      </section>

      <section className="project-details-grid">
        <div>
          <h2>Principal Investigator Names</h2>
          {piNames.length > 0 ? (
            <ul className="project-details-list">
              {piNames.map((name) => (
                <li key={name}>
                  {onOpenInvestigator ? (
                    <button
                      type="button"
                      className="pi-link-button"
                      onClick={() => onOpenInvestigator(name)}
                    >
                      {name}
                    </button>
                  ) : (
                    name
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </div>

        <div>
          <h2>Funded Organization</h2>
          <p>{item.ORG_NAME ?? "—"}</p>
        </div>

        <div>
          <h2>Funded Location</h2>
          <p>{formatLocation(item)}</p>
        </div>

        <div>
          <h2>NIH Institute or Center</h2>
          <p>{item.IC_NAME ?? "—"}</p>
        </div>

        <div>
          <h2>Fiscal Year(s)</h2>
          <p>{fiscalYears}</p>
        </div>

        <div>
          <h2>Project Start/End</h2>
          <p>{projectDates}</p>
        </div>

        <div>
          <h2>Award Amount</h2>
          <p>{formatCurrency(item.TOTAL_COST as number | undefined)}</p>
        </div>

        <div>
          <h2>Activity Code</h2>
          <p>{item.ACTIVITY ?? "—"}</p>
        </div>

        <div className="project-details-keywords">
          <h2>Keywords or Research Terms</h2>
          {projectTerms.length > 0 ? (
            <div className="project-details-tags">
              {projectTerms.map((term) => (
                <span key={term} className="project-details-tag">
                  {term}
                </span>
              ))}
            </div>
          ) : (
            <p>—</p>
          )}
        </div>
      </section>

      {activityId && projectId ? <ProjectActivityTermsChart activityId={activityId} projectId={projectId} /> : null}
    </div>

    <aside className="project-details-similar" aria-labelledby="project-details-similar-heading">
      {projectId ? (
        <div className="project-details-similar-more-wrap">
          <button
            type="button"
            className="project-details-similar-more"
            onClick={() => navigate(`/semantic/similar/${encodeURIComponent(projectId)}`)}
          >
            Show more similar projects
          </button>
        </div>
      ) : null}
      <h2 id="project-details-similar-heading" className="project-details-similar-heading">
        Similar projects
      </h2>
      <p className="project-details-similar-lede">
        Nearest neighbors using indexed sentence embeddings (same data as the vector lab).
      </p>
      {!projectId ? (
        <p className="project-details-similar-muted">No document id on this record; vector similarity is unavailable.</p>
      ) : similarLoading ? (
        <p className="project-details-similar-muted" role="status">
          Loading similar grants…
        </p>
      ) : similarError ? (
        <div className="project-details-similar-alert" role="alert">
          <p>{similarError}</p>
          {similarError.toLowerCase().includes("embedding") ? (
            <p className="project-details-similar-muted">
              Reindex with embeddings enabled so k-NN can run for this document.
            </p>
          ) : null}
        </div>
      ) : similarNeighbors.length === 0 ? (
        <p className="project-details-similar-muted">No similar projects returned.</p>
      ) : (
        <ol className="project-details-similar-list">
          {similarNeighbors.map((neighbor, index) => {
            const nid = neighbor._id ?? neighbor.id ?? "";
            const score = typeof neighbor._score === "number" ? neighbor._score : null;
            return (
              <li key={nid || String(index)} className="project-details-similar-item">
                <div className="project-details-similar-item-head">
                  <span className="project-details-similar-rank">{index + 1}</span>
                  {score != null ? (
                    <span className="project-details-similar-score" title="OpenSearch k-NN score">
                      {score.toFixed(3)}
                    </span>
                  ) : null}
                </div>
                <p className="project-details-similar-item-title">{neighbor.PROJECT_TITLE ?? "Untitled"}</p>
                <div className="project-details-similar-item-meta">
                  {neighbor.ACTIVITY ? <span className="tag activity">{neighbor.ACTIVITY}</span> : null}
                  {neighbor.FY != null ? <span className="tag fy">FY {neighbor.FY}</span> : null}
                </div>
                <p className="project-details-similar-item-cost">{formatCurrency(neighbor.TOTAL_COST as number | undefined)}</p>
                {onOpenDetails && nid ? (
                  <button
                    type="button"
                    className="project-details-similar-open"
                    onClick={() => onOpenDetails(neighbor)}
                  >
                    View project
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {projectId ? (
        <div className="project-details-similar-more-wrap project-details-similar-more-wrap--bottom">
          <button
            type="button"
            className="project-details-similar-more"
            onClick={() => navigate(`/semantic/similar/${encodeURIComponent(projectId)}`)}
          >
            Show more similar projects
          </button>
        </div>
      ) : null}
    </aside>
    </div>
  );
}
