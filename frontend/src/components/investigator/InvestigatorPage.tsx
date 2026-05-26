import type { SearchResultRecord } from "../../api";
import BackToResultsButton from "../shared/BackToResultsButton";
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
  onOpenInvestigator?: (name: string) => void;
  onOpenOrganization?: (name: string) => void;
  onOpenInstitution?: (name: string) => void;
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
  onOpenOrganization,
  onOpenInstitution,
  onPageChange,
  onBack,
}: InvestigatorPageProps) {
  return (
    <>
      <BackToResultsButton onClick={onBack} />

      <div className="flex items-baseline gap-3 flex-wrap mt-3 mb-2 px-1">
        <span className="text-[0.92rem] text-text-secondary">
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

      {error ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-text-muted text-[0.92rem]" role="status" aria-live="polite">
          <strong className="text-text-secondary text-[15px]">{error}</strong>
        </div>
      ) : (
        <ResultsList
          results={results}
          primarySort="relevant"
          loading={loading}
          onOpenDetails={onOpenDetails}
          onOpenInvestigator={onOpenInvestigator}
          onOpenOrganization={onOpenOrganization}
          onOpenInstitution={onOpenInstitution}
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
