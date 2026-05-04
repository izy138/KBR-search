
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Charts from "./components/Charts";
import Filters from "./components/Filters";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";

type SearchResult = {
  _id?: string;
  id?: string;
  title?: string;
  project_title?: string;
  abstract?: string;
  category?: string;
  [key: string]: unknown;
};

type AnalyticsPoint = {
  label: string;
  value: number;
};

const API_BASE_URL = "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [chartData, setChartData] = useState<AnalyticsPoint[]>([]);

  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  const categories = useMemo(() => {
    const source = chartData.length ? chartData : [];
    return source.map((point) => point.label);
  }, [chartData]);

  const totalPages = Math.max(1, Math.ceil(total / resultsPerPage));

  const loadAnalytics = async () => {
    const payload = await getAnalyticsSummary();
    setChartData(payload.by_category ?? []);
  };

  const runSearch = useCallback(
    async (nextQuery: string, page: number, category: string, limit: number) => {
      const payload = await searchProjects(nextQuery, {
        page,
        limit,
        category,
      });
      setResults(payload.results ?? []);
      setTotal(payload.total ?? 0);
    },
    [],
  );

  const handleSearch = (nextQuery: string) => {
    setQuery(nextQuery);
    setCurrentPage(1);
  };

  useEffect(() => {
    void runSearch(query, currentPage, selectedCategory, resultsPerPage);
  }, [query, currentPage, selectedCategory, resultsPerPage, runSearch]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleResultsPerPageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setResultsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  const getPageNumbers = (
    page: number,
    totalPageCount: number,
  ): Array<number | "..."> => {
    if (totalPageCount <= 7) {
      return Array.from({ length: totalPageCount }, (_, i) => i + 1);
    }

    const pages: Array<number | "..."> = [1];

    if (page > 3) {
      pages.push("...");
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPageCount - 1, page + 1);

    for (let p = start; p <= end; p += 1) {
      pages.push(p);
    }

    if (page < totalPageCount - 2) {
      pages.push("...");
    }

    pages.push(totalPageCount);

    return pages;
  };

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <main className="container">
      <h1>KBR Internship Search</h1>

      <SearchBar onSearch={handleSearch} />

      <button onClick={() => void loadAnalytics()} type="button">
        Load Analytics
      </button>

      <Filters
        categories={categories}
        selectedCategory={selectedCategory}
        onChange={handleCategoryChange}
      />

      <label>
        Results per page:
        <select value={resultsPerPage} onChange={handleResultsPerPageChange}>
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <Charts data={chartData} />

      <h2>Results for: {query || "all records"}</h2>
      <p>
        Showing page {currentPage} of {totalPages} ({total} total results)
      </p>

      <ResultsList
        results={results.map((item, index) => ({
          id: item._id ?? item.id ?? String(index),
          title:
            typeof item.title === "string"
              ? item.title
              : typeof item.project_title === "string"
                ? item.project_title
                : "Untitled",
          snippet:
            typeof item.abstract === "string"
              ? item.abstract.slice(0, 200)
              : "No abstract available",
        }))}
      />

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>

        {pageNumbers.map((item, index) =>
          item === "..." ? (
            <span key={`ellipsis-${index}`} style={{ padding: "0.5rem 0.25rem" }}>
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => setCurrentPage(item)}
              disabled={item === currentPage}
              style={
                item === currentPage
                  ? { background: "#1f2937", borderColor: "#1f2937" }
                  : undefined
              }
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </main>
  );
}