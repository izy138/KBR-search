import type { SearchResultRecord } from "../api";

type ProjectDetailsPageProps = {
  item: SearchResultRecord;
  onBack: () => void;
};

function parsePiNames(rawNames: string): string[] {
  return rawNames
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseSemicolonTerms(rawTerms: string | undefined): string[] {
  if (!rawTerms) return [];
  return rawTerms
    .split(";")
    .map((term) => term.trim())
    .filter(Boolean);
}

function getLastName(value: string): string {
  const withoutContact = value.replace("(contact)", "").trim();
  const parts = withoutContact.split(/\s+/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function sortPiNames(rawNames: string | undefined): string[] {
  if (!rawNames) return [];
  const names = parsePiNames(rawNames);
  const contactNames = names.filter((name) => name.includes("(contact)"));
  const nonContactNames = names
    .filter((name) => !name.includes("(contact)"))
    .sort((a, b) => getLastName(a).localeCompare(getLastName(b)));
  return [...contactNames, ...nonContactNames];
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

export default function ProjectDetailsPage({ item, onBack }: ProjectDetailsPageProps) {
  const piNames = sortPiNames(item.PI_NAMEs);
  const projectTerms = parseSemicolonTerms(item.PROJECT_TERMS);
  const fiscalYears = item.FY != null ? String(item.FY) : "—";
  const projectDates = [item.PROJECT_START, item.PROJECT_END].filter(Boolean).join(" to ") || "—";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-dot" />
          NIH Project Search
        </div>
      </header>

      <main className="app-main">
        <div className="project-details-card">
          <button type="button" className="project-back-link" onClick={onBack}>
            Back to results
          </button>

          <h1 className="project-details-title">{item.PROJECT_TITLE ?? "Untitled Project"}</h1>

          <section className="project-details-section">
            <h2>Project Abstract</h2>
            <p className="project-details-placeholder">
              Placeholder: abstract mapping to `RePORTER_PRJABS_C_FY2025.csv` via `APPLICATION_ID`
              will be added by your teammate.
            </p>
          </section>

          <section className="project-details-grid">
            <div>
              <h2>Principal Investigator Names</h2>
              {piNames.length > 0 ? (
                <ul className="project-details-list">
                  {piNames.map((name) => (
                    <li key={name}>{name}</li>
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
      </main>
    </div>
  );
}
