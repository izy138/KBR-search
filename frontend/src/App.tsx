import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Filters from "./components/Filters";
import InvestigatorPage from "./components/InvestigatorPage";
import ProjectDetailsPage from "./components/ProjectDetailsPage";
import ResultsList from "./components/ResultsList";
import SearchBar from "./components/SearchBar";
import {
  getProjectsByInvestigator,
  getProjectById,
  type SearchResultRecord,
  searchProjects,
} from "./api";

type View = "search" | "dashboard";

function getPageNumbers(page: number, totalPageCount: number): Array<number | "..."> {
  if (totalPageCount <= 5) {
    return Array.from({ length: totalPageCount }, (_, i) => i + 1);
  }
  const start = Math.max(1, page);
  const end = Math.min(totalPageCount, start + 2);
  const pages: Array<number | "..."> = [];

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < totalPageCount - 1) {
    pages.push("...");
  }
  if (end < totalPageCount) {
    pages.push(totalPageCount);
  }

  return pages;
}

export default function App() {
  type SortOption = "relevant" | "alphaAsc" | "alphaDesc" | "dateDesc" | "dateAsc";
  type Theme = "light" | "dark";
  type LightTheme = "default" | "blueAccent" | "yellowBeige" | "mintSlate" | "blueModified";

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
  const [jumpToPageInput, setJumpToPageInput] = useState("1");
  const [total, setTotal] = useState(0);
  const [visibleTotal, setVisibleTotal] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>("dateDesc");
  const [selectedProject, setSelectedProject] = useState<SearchResultRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string>("");
  const [investigatorResults, setInvestigatorResults] = useState<SearchResultRecord[]>([]);
  const [investigatorLoading, setInvestigatorLoading] = useState(false);
  const [investigatorError, setInvestigatorError] = useState<string>("");
  const [investigatorPage, setInvestigatorPage] = useState(1);
  const [investigatorTotal, setInvestigatorTotal] = useState(0);
  const [investigatorVisibleTotal, setInvestigatorVisibleTotal] = useState(0);
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
      || storedLightTheme === "blueModified"
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
  const investigatorRouteMatch = matchPath("/investigators/:investigatorName", location.pathname);
  const selectedInvestigatorName = investigatorRouteMatch?.params.investigatorName
    ? decodeURIComponent(investigatorRouteMatch.params.investigatorName)
    : null;
  const investigatorPerPage = 25;
  const investigatorTotalPages = Math.max(1, Math.ceil(investigatorVisibleTotal / investigatorPerPage));
  const investigatorPageNumbers = getPageNumbers(investigatorPage, investigatorTotalPages);

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
    if (view === "dashboard" || selectedProjectId || selectedInvestigatorName) {
      return;
    }
    void runSearch(query, currentPage, resultsPerPage);
  }, [query, currentPage, resultsPerPage, runSearch, view, selectedProjectId, selectedInvestigatorName]);

  useEffect(() => {
    setJumpToPageInput(String(currentPage));
  }, [currentPage]);

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

  const handlePerPageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setResultsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleJumpToPageSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = Number.parseInt(jumpToPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setJumpToPageInput(String(currentPage));
      return;
    }
    const boundedPage = Math.min(totalPages, Math.max(1, parsed));
    setCurrentPage(boundedPage);
    setJumpToPageInput(String(boundedPage));
  };

  const handleOpenDetails = (item: SearchResultRecord): void => {
    const projectId = item._id ?? item.id;
    if (!projectId) return;
    navigate(`/projects/${encodeURIComponent(projectId)}`);
  };
  const handleOpenInvestigator = (name: string): void => {
    setInvestigatorPage(1);
    navigate(`/investigators/${encodeURIComponent(name)}`);
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

  useEffect(() => {
    let isCancelled = false;
    if (!selectedInvestigatorName) {
      setInvestigatorResults([]);
      setInvestigatorError("");
      setInvestigatorLoading(false);
      return;
    }

    setInvestigatorLoading(true);
    setInvestigatorError("");
    void getProjectsByInvestigator(selectedInvestigatorName, {
      limit: investigatorPerPage,
      page: investigatorPage,
    })
      .then((payload) => {
        if (isCancelled) return;
        setInvestigatorResults(payload.results ?? []);
        setInvestigatorTotal(payload.total ?? 0);
        setInvestigatorVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      })
      .catch(() => {
        if (isCancelled) return;
        setInvestigatorResults([]);
        setInvestigatorTotal(0);
        setInvestigatorVisibleTotal(0);
        setInvestigatorError("Unable to load investigator projects right now.");
      })
      .finally(() => {
        if (isCancelled) return;
        setInvestigatorLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedInvestigatorName, investigatorPage]);

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

        {/* Header right Theme toggle*/}
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
                <option value="blueModified">Blue modified</option>
              </select>
            </label>
          )}

          {/* Theme toggle */}
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

          {/* Partner logos */}
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
      <section
        style={view === "dashboard" ? undefined : { display: "none" }}
        aria-hidden={view !== "dashboard"}
      >
        <Dashboard />
      </section>
      <main
        className="app-main"
        ref={mainRef}
        style={view === "dashboard" ? { display: "none" } : undefined}
        aria-hidden={view === "dashboard"}
      >
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
              onOpenInvestigator={handleOpenInvestigator}
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
        ) : selectedInvestigatorName ? (
          <InvestigatorPage
            investigatorName={selectedInvestigatorName}
            loading={investigatorLoading}
            error={investigatorError}
            results={investigatorResults}
            visibleTotal={investigatorVisibleTotal}
            total={investigatorTotal}
            currentPage={investigatorPage}
            totalPages={investigatorTotalPages}
            pageNumbers={investigatorPageNumbers}
            onOpenDetails={handleOpenDetails}
            onOpenInvestigator={handleOpenInvestigator}
            onPageChange={setInvestigatorPage}
            onBack={() => navigate("/")}
          />
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
                  aria-label="Sort results"
                >
                  <option value="relevant">Most Relevant</option>
                  <option value="dateDesc">Date: Most Recent</option>
                  <option value="dateAsc">Date: Least Recent</option>
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

            <ResultsList
              results={results}
              primarySort={sortOption}
              loading={loading}
              onOpenDetails={handleOpenDetails}
              onOpenInvestigator={handleOpenInvestigator}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn-page"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  aria-label="Go to first page"
                >
                  «
                </button>

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

                

                <form className="page-jump-form" onSubmit={handleJumpToPageSubmit}>
                  <input
                    className="page-jump-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={jumpToPageInput}
                    onChange={(e) => setJumpToPageInput(e.target.value.replace(/\D/g, ""))}
                    aria-label={`Jump to page between 1 and ${totalPages}`}
                  />
                  <button className="btn-page btn-page-jump" type="submit">
                    Go
                  </button>
                </form>
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
