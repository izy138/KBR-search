import type { SearchResultRecord } from "../../api";
import Pagination from "../shared/Pagination";
import ResultsList from "../search/ResultsList";

type InvestigatorPageProps = {
  investigatorName: string;
  loading: boolean;
  error: string;
  results: SearchResultRecord[];
  visibleTotal: number;
  total: number;
  currentPage: number;
  totalPages: number;
  pageNumbers: Array<number | "...">;
  onOpenDetails: (item: SearchResultRecord) => void;
  onOpenInvestigator: (name: string) => void;
  onPageChange: (page: number) => void;
  onBack: () => void;
};

export default function InvestigatorPage({
  investigatorName,
  loading,
  error,
  results,
  visibleTotal,
  total,
  currentPage,
  totalPages,
  pageNumbers,
  onOpenDetails,
  onOpenInvestigator,
  onPageChange,
  onBack,
}: InvestigatorPageProps) {
  return (
    <>
      <button type="button" className="project-back-link" onClick={onBack}>
        Back to results
      </button>

      <div className="results-header" style={{ marginTop: "0.75rem" }}>
        <div className="results-meta">
          <span>
            <strong>{investigatorName}</strong>
            {!loading && (
              <>
                {" — "}
                <strong>{visibleTotal.toLocaleString()}</strong> projects
                {total > visibleTotal ? ` out of ${total.toLocaleString()}` : ""}
                {currentPage > 1 ? ` — page ${currentPage} of ${totalPages}` : ""}
              </>
            )}
          </span>
        </div>
      </div>

      {error ? (
        <div className="empty-state" role="status" aria-live="polite">
          <strong style={{ color: "var(--text-secondary)", fontSize: 15 }}>{error}</strong>
        </div>
      ) : (
        <ResultsList
          results={results}
          primarySort="relevant"
          loading={loading}
          onOpenDetails={onOpenDetails}
          onOpenInvestigator={onOpenInvestigator}
        />
      )}

      {!loading && !error && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          onPageChange={onPageChange}
        />
      )}
    </>
  );
}
