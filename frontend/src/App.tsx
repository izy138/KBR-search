import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Filters from "./components/Filters";
import ProjectDetailsPage from "./components/ProjectDetailsPage";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import {
  getProjectById,
  type SearchResultRecord,
  searchProjects,
} from "./api";

type View = "search" | "dashboard";

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
  type SortOption = "alphaAsc" | "alphaDesc" | "dateDesc" | "dateAsc" | "costDesc" | "costAsc";
  type Theme = "light" | "dark";
  type LightTheme = "default" | "blueAccent" | "yellowBeige" | "mintSlate";

  const [view, setView] = useState<View>("search");
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
  const [visibleTotal, setVisibleTotal] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>("dateDesc");
  const [selectedProject, setSelectedProject] = useState<SearchResultRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string>("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [lightTheme, setLightTheme] = useState<LightTheme>(() => {
    if (typeof window === "undefined") return "default";
    const storedLightTheme = window.localStorage.getItem("lightTheme");
    if (
      storedLightTheme === "default"
      || storedLightTheme === "blueAccent"
      || storedLightTheme === "yellowBeige"
      || storedLightTheme === "mintSlate"
    ) {
      return storedLightTheme;
    }
    return "default";
  });

  const totalPages = Math.max(1, Math.ceil(visibleTotal / resultsPerPage));
  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const mainRef = useRef<HTMLElement | null>(null);
  const projectRouteMatch = matchPath("/projects/:projectId", location.pathname);
  const selectedProjectId = projectRouteMatch?.params.projectId ?? null;

  // Derive filter options from loaded results (simple approach — can be replaced with API aggs)
  const icNames = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      if (r.IC_NAME) set.add(r.IC_NAME);
    });
    return Array.from(set).sort();
  }, [results]);

  const activityCodes = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      if (r.ACTIVITY) set.add(r.ACTIVITY);
    });
    return Array.from(set).sort();
  }, [results]);

  const states = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      if (r.ORG_STATE) set.add(r.ORG_STATE);
    });
    return Array.from(set).sort();
  }, [results]);

  const runSearch = useCallback(
    async (q: string, page: number, limit: number) => {
      setLoading(true);
      try {
        const payload = await searchProjects(q, {
          page,
          limit,
          ic: selectedIC,
          activity: selectedActivity,
          state: selectedState,
          fyMin,
          fyMax,
          costMin,
          costMax,
        });
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
        setVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [selectedIC, selectedActivity, selectedState, fyMin, fyMax, costMin, costMax],
  );

  useEffect(() => {
    void runSearch(query, currentPage, resultsPerPage);
  }, [query, currentPage, resultsPerPage, runSearch]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-light-theme", lightTheme);
    window.localStorage.setItem("lightTheme", lightTheme);
  }, [lightTheme]);

  useEffect(() => {
    const mainElement = mainRef.current;

    const handleScroll = () => {
      const windowOffset = window.scrollY || document.documentElement.scrollTop || 0;
      const mainOffset = mainElement?.scrollTop ?? 0;
      setShowScrollTop(Math.max(windowOffset, mainOffset) > 550);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    mainElement?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mainElement?.removeEventListener("scroll", handleScroll);
    };
  }, []);

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

  const sortedResults = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

    const getTitle = (record: SearchResultRecord): string =>
      record.PROJECT_TITLE ?? record.project_title ?? record.title ?? "";

    const getDateTimestamp = (record: SearchResultRecord): number => {
      const rawDate = record.PROJECT_START ?? record.PROJECT_END;
      if (!rawDate) return Number.NEGATIVE_INFINITY;
      const parsed = Date.parse(rawDate);
      return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    };

    const getTotalCost = (record: SearchResultRecord): number => {
      const value = record.TOTAL_COST;
      return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
    };

    return [...results].sort((a, b) => {
      if (sortOption === "alphaAsc") {
        return collator.compare(getTitle(a), getTitle(b));
      }
      if (sortOption === "alphaDesc") {
        return collator.compare(getTitle(b), getTitle(a));
      }
      if (sortOption === "dateAsc") {
        return getDateTimestamp(a) - getDateTimestamp(b);
      }
      if (sortOption === "costAsc") {
        return getTotalCost(a) - getTotalCost(b);
      }
      if (sortOption === "costDesc") {
        return getTotalCost(b) - getTotalCost(a);
      }
      return getDateTimestamp(b) - getDateTimestamp(a);
    });
  }, [results, sortOption]);

  const handlePerPageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setResultsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleOpenDetails = (item: SearchResultRecord): void => {
    const projectId = item._id ?? item.id;
    if (!projectId) return;
    navigate(`/projects/${encodeURIComponent(projectId)}`);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    mainRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    let isCancelled = false;
    if (!selectedProjectId) {
      setSelectedProject(null);
      setProjectLoading(false);
      setProjectError("");
      return;
    }

    const projectFromResults = results.find(
      (item) => (item._id ?? item.id) === selectedProjectId,
    );
    if (projectFromResults) {
      setSelectedProject(projectFromResults);
      setProjectLoading(false);
      setProjectError("");
      return;
    }

    setProjectLoading(true);
    setProjectError("");
    void getProjectById(selectedProjectId)
      .then((project) => {
        if (isCancelled) return;
        setSelectedProject(project);
      })
      .catch(() => {
        if (isCancelled) return;
        setSelectedProject(null);
        setProjectError("Unable to load this project right now.");
      })
      .finally(() => {
        if (isCancelled) return;
        setProjectLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedProjectId, results]);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <button
          type="button"
          className="header-logo"
          onClick={() => navigate("/")}
          aria-label="Return to search results"
        >
          <div className="header-logo-dot" />
          NIH Project Search
        </button>
        <nav className="nav-tabs" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-tab${view === "search" ? " active" : ""}`}
            onClick={() => setView("search")}
          >
            Search
          </button>
          <button
            type="button"
            className={`nav-tab${view === "dashboard" ? " active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
        </nav>
        <div className="header-right">
          {theme === "light" && (
            <label className="theme-palette-picker">
              <span className="theme-palette-label">Light theme</span>
              <select
                className="theme-palette-select"
                value={lightTheme}
                onChange={(event) => setLightTheme(event.target.value as LightTheme)}
                aria-label="Select light color theme"
              >
                <option value="default">Default</option>
                <option value="blueAccent">Blue accent</option>
                <option value="yellowBeige">Yellow beige</option>
                <option value="mintSlate">Mint slate</option>
              </select>
            </label>
          )}
          <button
            className="theme-toggle"
            type="button"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "Dark mode" : "Light mode"}
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === "light" ? "🌙" : "☀️"}
            </span>
          </button>
          <div className="header-images" aria-label="Partner logos">
            <img src="/Images/KBR_(company)_logo.svg" alt="KBR logo" className="header-image header-image-kbr" />
            <img
              src="/Images/Florida_International_University_FIU_logo.svg.png"
              alt="FIU logo"
              className="header-image header-image-fiu"
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      {view === "dashboard" && <Dashboard />}
      <main className="app-main" ref={mainRef} style={view === "dashboard" ? { display: "none" } : undefined}>
        {selectedProjectId ? (
          projectLoading ? (
            <div className="empty-state" role="status" aria-live="polite">
              <strong style={{ color: "var(--text-secondary)", fontSize: 15 }}>Loading project…</strong>
            </div>
          ) : projectError ? (
            <div className="empty-state" role="status" aria-live="polite">
              <strong style={{ color: "var(--text-secondary)", fontSize: 15 }}>{projectError}</strong>
              <button
                type="button"
                className="project-back-link"
                onClick={() => navigate("/")}
                style={{ marginTop: "0.85rem" }}
              >
                Back to results
              </button>
            </div>
          ) : selectedProject ? (
            <ProjectDetailsPage
              item={selectedProject}
              onBack={() => navigate("/")}
            />
          ) : (
            <div className="empty-state" role="status" aria-live="polite">
              <strong style={{ color: "var(--text-secondary)", fontSize: 15 }}>Project not found</strong>
              <button
                type="button"
                className="project-back-link"
                onClick={() => navigate("/")}
                style={{ marginTop: "0.85rem" }}
              >
                Back to results
              </button>
            </div>
          )
        ) : (
          <>
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

            <div className="search-row">
              <div className="search-row-inner">
                <SearchBar onSearch={handleSearch} initialQuery={query} />
              </div>
            </div>

            <div className="results-header">
              <div className="results-meta">
                {loading ? (
                  <span>Searching…</span>
                ) : (
                  <span>
                    <strong>{visibleTotal.toLocaleString()}</strong> results
                    {total > visibleTotal ? ` out of ${total.toLocaleString()}` : ""}
                    {query ? ` for "${query}"` : ""}
                    {currentPage > 1 ? ` — page ${currentPage} of ${totalPages}` : ""}
                  </span>
                )}
              </div>
              <div className="results-controls">
                <select
                  className="per-page-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                >
                  <option value="dateDesc">Date: Most Recent</option>
                  <option value="dateAsc">Date: Least Recent</option>
                  <option value="costDesc">Total Cost: Highest</option>
                  <option value="costAsc">Total Cost: Lowest</option>
                  <option value="alphaAsc">Title: A to Z</option>
                  <option value="alphaDesc">Title: Z to A</option>
                </select>
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

            <ResultsList results={sortedResults} loading={loading} onOpenDetails={handleOpenDetails} />

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

            {showScrollTop && (
              <button
                type="button"
                className="scroll-top-btn"
                onClick={handleScrollToTop}
                aria-label="Scroll back to top"
              >
                ↑
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
