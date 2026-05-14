import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProjectFiscalYear, ProjectYearVariant, SearchResultRecord } from "../api";
import { getProjectOtherYears, searchSimilarToProjectId } from "../api";
import { getOrderedPiNames } from "../utils/piNames";
import ProjectActivityTermsChart from "./ProjectActivityTermsChart";

type ProjectSearchTermsPayload = {
  terms: string[];
  additionalQuery: string;
};

type ProjectDetailsPageProps = {
  item: SearchResultRecord;
  onBack: () => void;
  onOpenInvestigator?: (name: string) => void;
  onOpenDetails?: (item: SearchResultRecord) => void;
  onSearchWithProjectTerms?: (payload: ProjectSearchTermsPayload) => void;
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

function dedupeTermsPreserveOrder(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const s = t.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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

function getYearVariants(record: SearchResultRecord): ProjectYearVariant[] {
  const raw = record.year_variants;
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ProjectYearVariant =>
        item != null &&
        typeof item === "object" &&
        typeof (item as ProjectYearVariant).project_id === "string",
    );
  }
  const recordId = record._id ?? record.id;
  if (typeof recordId === "string") {
    return [
      {
        project_id: recordId,
        fy: typeof record.FY === "number" ? record.FY : undefined,
        application_id: typeof record.APPLICATION_ID === "number" ? record.APPLICATION_ID : undefined,
      },
    ];
  }
  return [];
}

export default function ProjectDetailsPage({
  item,
  onBack,
  onOpenInvestigator,
  onOpenDetails,
  onSearchWithProjectTerms,
}: ProjectDetailsPageProps) {
  const navigate = useNavigate();
  const piNames = getOrderedPiNames(item.PI_NAMEs);
  const dedupedProjectTerms = useMemo(
    () => dedupeTermsPreserveOrder(parseSemicolonTerms(item.PROJECT_TERMS)),
    [item.PROJECT_TERMS],
  );
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(() => new Set());
  const [keywordExtra, setKeywordExtra] = useState<string>("");
  const projectAbstract = getProjectAbstract(item);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState<boolean>(false);
  const fiscalYears = item.FY != null ? String(item.FY) : "—";
  const projectDates = [item.PROJECT_START, item.PROJECT_END].filter(Boolean).join(" to ") || "—";
  const activityId = typeof item.ACTIVITY === "string" ? item.ACTIVITY.trim() : "";
  const projectId = typeof item._id === "string" ? item._id : typeof item.id === "string" ? item.id : "";
  const [similarNeighbors, setSimilarNeighbors] = useState<SearchResultRecord[]>([]);
  const [similarLoading, setSimilarLoading] = useState<boolean>(false);
  const [similarError, setSimilarError] = useState<string>("");
  const [projectYears, setProjectYears] = useState<ProjectFiscalYear[]>([]);
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
    setSelectedTerms(new Set());
    setKeywordExtra("");
  }, [item._id, item.APPLICATION_ID]);

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

  useEffect(() => {
    if (!projectId) {
      setProjectYears([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const payload = await getProjectOtherYears(projectId);
        if (!cancelled) {
          setProjectYears(payload.years ?? payload.other_years ?? []);
        }
      } catch {
        if (!cancelled) {
          setProjectYears([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleOpenProjectYear = (year: ProjectFiscalYear): void => {
    if (!year.project_id || year.project_id === projectId) return;
    if (onOpenDetails) {
      onOpenDetails({ _id: year.project_id, FY: year.fy, APPLICATION_ID: year.application_id });
      return;
    }
    navigate(`/projects/${encodeURIComponent(year.project_id)}`);
  };

  const handleOpenYearVariant = (variant: ProjectYearVariant): void => {
    if (!variant.project_id) return;
    if (onOpenDetails) {
      onOpenDetails({
        _id: variant.project_id,
        FY: variant.fy,
        APPLICATION_ID: variant.application_id,
      });
      return;
    }
    navigate(`/projects/${encodeURIComponent(variant.project_id)}`);
  };

  const toggleTermSelection = (term: string): void => {
    setSelectedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(term)) {
        next.delete(term);
      } else {
        next.add(term);
      }
      return next;
    });
  };

  const clearKeywordPanel = (): void => {
    setSelectedTerms(new Set());
    setKeywordExtra("");
  };

  const handleProjectKeywordSearch = (): void => {
    if (!onSearchWithProjectTerms) return;
    const terms = [...selectedTerms];
    const additionalQuery = keywordExtra.trim();
    if (terms.length === 0 && !additionalQuery) return;
    onSearchWithProjectTerms({ terms, additionalQuery });
  };

  return (
    <div className="project-details-layout">
    <div className="project-details-main-stack">
    <div className="project-details-card">
      <div className="project-details-top-row">
        <button type="button" className="project-back-link" onClick={onBack}>
          Back to results
        </button>
        {projectYears.length > 1 ? (
          <div className="project-details-year-tags" aria-label="Fiscal years for this project">
            {projectYears.map((year) => {
              const isActive = year.project_id === projectId || year.is_current === true;
              if (isActive) {
                return (
                  <span
                    key={year.project_id}
                    className="project-details-year-tag project-details-year-tag--active"
                    aria-current="page"
                  >
                    {year.fy != null ? `FY ${year.fy}` : "Current year"}
                  </span>
                );
              }
              return (
                <button
                  key={year.project_id}
                  type="button"
                  className="project-details-year-tag"
                  onClick={() => handleOpenProjectYear(year)}
                >
                  {year.fy != null ? `FY ${year.fy}` : "Other year"}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="project-details-year-tags" aria-hidden="true" />
        )}
        {projectId ? (
          <button
            type="button"
            className="project-vector-link"
            onClick={() => navigate(`/semantic/similar/${encodeURIComponent(projectId)}`)}
          >
            Similar grants (vectors)
          </button>
        ) : (
          <span />
        )}
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
          {dedupedProjectTerms.length > 0 ? (
            <>
              <div className="project-details-tags" role="group" aria-label="Project keyword tags">
                {dedupedProjectTerms.map((term) => {
                  const isOn = selectedTerms.has(term);
                  return (
                    <button
                      key={term}
                      type="button"
                      className={`project-details-tag${isOn ? " project-details-tag--selected" : ""}`}
                      aria-pressed={isOn}
                      onClick={() => toggleTermSelection(term)}
                    >
                      {term}
                    </button>
                  );
                })}
              </div>
              {onSearchWithProjectTerms ? (
                <div className="project-details-keyword-search">
                  <p className="project-details-keyword-search-label">
                    Search other projects using selected tags (and optional text):
                  </p>
                  <ul className="project-details-keyword-chips" aria-label="Selected keywords for search">
                    {selectedTerms.size === 0 ? (
                      <li className="project-details-keyword-chips-empty">No tags selected yet</li>
                    ) : (
                      [...selectedTerms].map((term) => (
                        <li key={term}>
                          <button
                            type="button"
                            className="project-details-keyword-chip"
                            onClick={() => toggleTermSelection(term)}
                            aria-label={`Remove ${term}`}
                          >
                            {term}
                            <span className="project-details-keyword-chip-x" aria-hidden="true">
                              ×
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="project-details-keyword-search-row">
                    <label className="project-details-keyword-input-label" htmlFor="project-keyword-extra">
                      Also include in search
                    </label>
                    <input
                      id="project-keyword-extra"
                      type="text"
                      className="project-details-keyword-input"
                      placeholder="Optional words (title, PI, keywords…)"
                      value={keywordExtra}
                      onChange={(e) => setKeywordExtra(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="project-details-keyword-actions">
                    <button
                      type="button"
                      className="btn-project-keyword-search"
                      disabled={selectedTerms.size === 0 && keywordExtra.trim() === ""}
                      onClick={handleProjectKeywordSearch}
                    >
                      Search Projects
                    </button>
                    {(selectedTerms.size > 0 || keywordExtra.trim() !== "") ? (
                      <button type="button" className="btn-project-keyword-clear" onClick={clearKeywordPanel}>
                        Clear selection
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p>—</p>
          )}
        </div>
      </section>
    </div>

    {activityId && projectId ? (
      <div className="project-activity-widget" role="region" aria-label="Activity funding comparison">
        <ProjectActivityTermsChart activityId={activityId} projectId={projectId} />
      </div>
    ) : null}
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
            const yearVariants = getYearVariants(neighbor);
            const listKey = yearVariants.map((variant) => variant.project_id).join("-") || String(index);
            const primaryId = yearVariants[0]?.project_id ?? neighbor._id ?? neighbor.id ?? "";
            return (
              <li key={listKey} className="project-details-similar-item">
                <div className="project-details-similar-item-top">
                  {yearVariants.length > 0 ? (
                    <div
                      className="project-details-similar-year-tags"
                      aria-label="Fiscal years for this similar project"
                    >
                      {yearVariants.map((variant) => (
                        <button
                          key={variant.project_id}
                          type="button"
                          className="project-details-similar-year-tag"
                          onClick={() => handleOpenYearVariant(variant)}
                        >
                          {variant.fy != null ? `FY ${variant.fy}` : "Year"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="project-details-similar-year-tags" aria-hidden="true" />
                  )}
                  <div className="project-details-similar-item-trailing">
                    {neighbor.ACTIVITY ? <span className="tag activity">{neighbor.ACTIVITY}</span> : null}
                    <span className="project-details-similar-item-cost">
                      {formatCurrency(neighbor.TOTAL_COST as number | undefined)}
                    </span>
                  </div>
                </div>
                <p className="project-details-similar-item-title">{neighbor.PROJECT_TITLE ?? "Untitled"}</p>
                {onOpenDetails && primaryId ? (
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
