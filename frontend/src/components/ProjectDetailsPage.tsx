import { useEffect, useState } from "react";
import type { SearchResultRecord } from "../api";
import { getOrderedPiNames } from "../utils/piNames";

type ProjectDetailsPageProps = {
  item: SearchResultRecord;
  onBack: () => void;
  onOpenInvestigator?: (name: string) => void;
};

const ABSTRACT_PREVIEW_LENGTH = 1500;

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

export default function ProjectDetailsPage({ item, onBack, onOpenInvestigator }: ProjectDetailsPageProps) {
  const piNames = getOrderedPiNames(item.PI_NAMEs);
  const projectTerms = parseSemicolonTerms(item.PROJECT_TERMS);
  const projectAbstract = getProjectAbstract(item);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState<boolean>(false);
  const fiscalYears = item.FY != null ? String(item.FY) : "—";
  const projectDates = [item.PROJECT_START, item.PROJECT_END].filter(Boolean).join(" to ") || "—";
  const isLongAbstract =
    projectAbstract != null && projectAbstract.length > ABSTRACT_PREVIEW_LENGTH;
  const abstractPreview =
    projectAbstract != null && isLongAbstract
      ? `${projectAbstract.slice(0, ABSTRACT_PREVIEW_LENGTH).trimEnd()}...`
      : projectAbstract;

  useEffect(() => {
    setIsAbstractExpanded(false);
  }, [item._id, item.APPLICATION_ID, item.PROJECT_TITLE]);

  return (
    <div className="project-details-card">
      <button type="button" className="project-back-link" onClick={onBack}>
        Back to results
      </button>

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
    </div>
  );
}
