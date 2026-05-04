import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Filters from "./components/Filters";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import {
  type SearchResultRecord,
  searchProjects,
} from "./api";

function getPageNumbers(page: number, totalPageCount: number): Array<number | "..."> {
  if (totalPageCount <= 7) {
    return Array.from({ length: totalPageCount }, (_, i) => i + 1);
  }
  const pages: Array<number | "..."> = [1];
  if (page > 3) pages.push("...");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPageCount - 1, page + 1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (page < totalPageCount - 2) pages.push("...");
  pages.push(totalPageCount);
  return pages;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");
  const [costMin, setCostMin] = useState("");
  const [costMax, setCostMax] = useState("");

  // Pagination
  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  // Derive filter options from loaded results (simple approach — can be replaced with API aggs)
  const icNames = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => { if (r.IC_NAME) set.add(r.IC_NAME); });
    return Array.from(set).sort();
  }, [results]);

  const activityCodes = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => { if (r.ACTIVITY) set.add(r.ACTIVITY); });
    return Array.from(set).sort();
  }, [results]);

  const states = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => { if (r.ORG_STATE) set.add(r.ORG_STATE); });
    return Array.from(set).sort();
  }, [results]);

  const runSearch = useCallback(
    async (q: string, page: number, limit: number) => {
      setLoading(true);
      try {
        const payload = await searchProjects(q, { page, limit });
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void runSearch(query, currentPage, resultsPerPage);
  }, [query, currentPage, resultsPerPage, runSearch]);

  const handleSearch = (nextQuery: string) => {
    setQuery(nextQuery);
    setCurrentPage(1);
  };

  const handleApplyFilters = (filters: {
    ic: string;
    activity: string;
    state: string;
    fyMin: string;
    fyMax: string;
    costMin: string;
    costMax: string;
  }) => {
    setSelectedIC(filters.ic);
    setSelectedActivity(filters.activity);
    setSelectedState(filters.state);
    setFyMin(filters.fyMin);
    setFyMax(filters.fyMax);
    setCostMin(filters.costMin);
    setCostMax(filters.costMax);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedIC("");
    setSelectedActivity("");
    setSelectedState("");
    setFyMin("");
    setFyMax("");
    setCostMin("");
    setCostMax("");
    setCurrentPage(1);
  };

  // Client-side filtering for activity/state/fy/cost (supplement server search)
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (selectedIC && r.IC_NAME !== selectedIC) return false;
      if (selectedActivity && r.ACTIVITY !== selectedActivity) return false;
      if (selectedState && r.ORG_STATE !== selectedState) return false;
      if (fyMin && r.FY != null && Number(r.FY) < Number(fyMin)) return false;
      if (fyMax && r.FY != null && Number(r.FY) > Number(fyMax)) return false;
      if (costMin && r.TOTAL_COST != null && Number(r.TOTAL_COST) < Number(costMin)) return false;
      if (costMax && r.TOTAL_COST != null && Number(r.TOTAL_COST) > Number(costMax)) return false;
      return true;
    });
  }, [results, selectedIC, selectedActivity, selectedState, fyMin, fyMax, costMin, costMax]);

  const handlePerPageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setResultsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <div className="header-logo-dot" />
          NIH Project Search
        </div>
        <SearchBar onSearch={handleSearch} initialQuery={query} />
      </header>

      {/* Sidebar */}
      <Filters
        icNames={icNames}
        activityCodes={activityCodes}
        states={states}
        selectedIC={selectedIC}
        selectedActivity={selectedActivity}
        selectedState={selectedState}
        fyMin={fyMin}
        fyMax={fyMax}
        costMin={costMin}
        costMax={costMax}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Main content */}
      <main className="app-main">
        {/* Analytics section intentionally disabled for now. */}

        <div className="results-header">
          <div className="results-meta">
            {loading ? (
              <span>Searching…</span>
            ) : (
              <span>
                <strong>{total.toLocaleString()}</strong> results
                {query ? ` for "${query}"` : ""}
                {currentPage > 1 ? ` — page ${currentPage} of ${totalPages}` : ""}
              </span>
            )}
          </div>
          <div className="results-controls">
            <select
              className="per-page-select"
              value={resultsPerPage}
              onChange={handlePerPageChange}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
        </div>

        <ResultsList results={filteredResults} loading={loading} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ←
            </button>

            {pageNumbers.map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="page-ellipsis">…</span>
              ) : (
                <button
                  key={item}
                  className={`btn-page${item === currentPage ? " active" : ""}`}
                  onClick={() => setCurrentPage(item as number)}
                  disabled={item === currentPage}
                >
                  {item}
                </button>
              ),
            )}

            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
