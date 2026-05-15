import {
  type ChangeEvent,
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme, type LightTheme } from "./hooks/useTheme";
import { useProjectDetails } from "./hooks/useProjectDetails";
import { useInvestigatorProjects, INVESTIGATOR_PER_PAGE } from "./hooks/useInvestigatorProjects";
import { useSearch } from "./hooks/useSearch";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import type { DashboardSearchFilters } from "./components/dashboard/Dashboard";
import Filters from "./components/search/Filters";
import InvestigatorPage from "./components/investigator/InvestigatorPage";
import ResultsList from "./components/search/ResultsList";
import SearchBar from "./components/search/SearchBar";
import Pagination, { getPageNumbers } from "./components/shared/Pagination";
import TermCloud from "./components/search/TermCloud";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { type SearchResultRecord } from "./api";
import { useFilterCatalog } from "./hooks/useFilterCatalog";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const ProjectDetailsPage = lazy(() => import("./components/project/ProjectDetailsPage"));
const SemanticVectorLabPage = lazy(() => import("./components/semantic/SemanticVectorLabPage"));
const SemanticSimilarProjectPage = lazy(() => import("./components/semantic/SemanticSimilarProjectPage"));

export default function App() {
  type SortOption = "relevant" | "alphaAsc" | "alphaDesc";

  // Filters
  const [selectedPI, setSelectedPI] = useState("");
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");

  // Pagination
  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToPageInput, setJumpToPageInput] = useState("1");
  const [sortOption, setSortOption] = useState<SortOption>("relevant");
  const [investigatorPage, setInvestigatorPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, lightTheme, setLightTheme, handleThemeToggle } = useTheme();

  const isDashboardRoute =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const view = isDashboardRoute ? "dashboard" : "search";

  const mainRef = useRef<HTMLElement | null>(null);
  const projectRouteMatch = matchPath("/projects/:projectId", location.pathname);
  const selectedProjectId = projectRouteMatch?.params.projectId ?? null;
  const semanticSimilarMatch = matchPath("/semantic/similar/:projectId", location.pathname);
  const semanticSimilarProjectId = semanticSimilarMatch?.params.projectId ?? null;
  const isSemanticHub =
    location.pathname === "/semantic" || location.pathname === "/semantic/";
  const isSemanticRoute = isSemanticHub || Boolean(semanticSimilarProjectId);
  const investigatorRouteMatch = matchPath("/investigators/:investigatorName", location.pathname);
  const selectedInvestigatorName = investigatorRouteMatch?.params.investigatorName
    ? decodeURIComponent(investigatorRouteMatch.params.investigatorName)
    : null;
  const searchEnabled =
    view !== "dashboard"
    && !selectedProjectId
    && !selectedInvestigatorName
    && !semanticSimilarProjectId
    && !isSemanticHub;

  const {
    query,
    setQuery,
    projectTermFilters,
    setProjectTermFilters,
    results,
    loading,
    total,
    visibleTotal,
  } = useSearch({
    selectedPI,
    selectedIC,
    selectedActivity,
    selectedState,
    fyMin,
    fyMax,
    currentPage,
    resultsPerPage,
    enabled: searchEnabled,
  });

  const { selectedProject, projectLoading, projectError } = useProjectDetails(
    selectedProjectId,
    results,
  );
  const {
    results: investigatorResults,
    loading: investigatorLoading,
    error: investigatorError,
    total: investigatorTotal,
    visibleTotal: investigatorVisibleTotal,
  } = useInvestigatorProjects(selectedInvestigatorName, investigatorPage);
  const investigatorTotalPages = Math.max(
    1,
    Math.ceil(investigatorVisibleTotal / INVESTIGATOR_PER_PAGE),
  );
  const investigatorPageNumbers = getPageNumbers(investigatorPage, investigatorTotalPages);

  const totalPages = Math.max(1, Math.ceil(visibleTotal / resultsPerPage));
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  /** Filter option lists shared with Dashboard — fetched once via module-level cache. */
  const searchFilterCatalog = useFilterCatalog();

  useEffect(() => {
    setJumpToPageInput(String(currentPage));
  }, [currentPage]);

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
    setProjectTermFilters([]);
    setCurrentPage(1);
  };

  const handleTermCloudSearch = (terms: string[]) => {
    setProjectTermFilters(terms);
    setCurrentPage(1);
  };

  const handleApplyFilters = (filters: {
    pi: string;
    ic: string;
    activity: string;
    state: string;
    fyMin: string;
    fyMax: string;
  }) => {
    setSelectedPI(filters.pi);
    setSelectedIC(filters.ic);
    setSelectedActivity(filters.activity);
    setSelectedState(filters.state);
    setFyMin(filters.fyMin);
    setFyMax(filters.fyMax);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedPI("");
    setSelectedIC("");
    setSelectedActivity("");
    setSelectedState("");
    setFyMin("");
    setFyMax("");
    setProjectTermFilters([]);
    setCurrentPage(1);
  };

  const handleDashboardSearchNavigate = useCallback(
    (searchQuery: string, filters: DashboardSearchFilters) => {
      setSelectedPI(filters.pi);
      setSelectedIC(filters.ic);
      setSelectedActivity(filters.activity);
      setSelectedState(filters.state);
      setFyMin(filters.fyMin);
      setFyMax(filters.fyMax);
      setQuery(searchQuery);
      setProjectTermFilters([]);
      setCurrentPage(1);
      navigate("/");
    },
    [navigate, setQuery, setProjectTermFilters],
  );

  const handleSearchFromProjectTerms = useCallback(
    (payload: { terms: string[]; additionalQuery: string }) => {
      setProjectTermFilters(payload.terms);
      setQuery(payload.additionalQuery.trim());
      setCurrentPage(1);
      navigate("/");
    },
    [navigate],
  );

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
            className={`nav-tab${view === "search" && !isSemanticRoute ? " active" : ""}`}
            onClick={() => navigate("/")}
          >
            Search
          </button>
          <button
            type="button"
            className={`nav-tab${view === "dashboard" && !isSemanticRoute ? " active" : ""}`}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-tab${isSemanticRoute ? " active" : ""}`}
            onClick={() => navigate("/semantic")}
          >
            Vector lab
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
        style={view === "dashboard" && !isSemanticRoute ? undefined : { display: "none" }}
        aria-hidden={view !== "dashboard" || isSemanticRoute}
      >
        <ErrorBoundary>
          <Suspense fallback={
            <div className="empty-state" role="status">
              <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading…</span>
            </div>
          }>
            <Dashboard onSearchNavigate={handleDashboardSearchNavigate} />
          </Suspense>
        </ErrorBoundary>
      </section>
      <main
        className="app-main"
        ref={mainRef}
        style={view === "dashboard" && !isSemanticRoute ? { display: "none" } : undefined}
        aria-hidden={view === "dashboard" && !isSemanticRoute}
      >
        <ErrorBoundary>
          <Suspense fallback={
            <div className="empty-state" role="status">
              <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading…</span>
            </div>
          }>
            {semanticSimilarProjectId ? (
          <SemanticSimilarProjectPage
            projectId={decodeURIComponent(semanticSimilarProjectId)}
            onBackToLab={() => navigate("/semantic")}
            onOpenFullProject={(id) => navigate(`/projects/${encodeURIComponent(id)}`)}
            onOpenInvestigator={handleOpenInvestigator}
          />
        ) : isSemanticHub ? (
          <SemanticVectorLabPage />
        ) : selectedProjectId ? (
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
              onOpenDetails={handleOpenDetails}
              onSearchWithProjectTerms={handleSearchFromProjectTerms}
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
              searchSlot={<SearchBar onSearch={handleSearch} initialQuery={query} />}
              icNames={searchFilterCatalog?.icNames ?? []}
              activityCodes={searchFilterCatalog?.activityCodes ?? []}
              states={searchFilterCatalog?.states ?? []}
              fiscalYearOptions={searchFilterCatalog?.fiscalYearOptions}
              selectedPI={selectedPI}
              selectedIC={selectedIC}
              selectedActivity={selectedActivity}
              selectedState={selectedState}
              fyMin={fyMin}
              fyMax={fyMax}
              onPIChange={setSelectedPI}
              onICChange={setSelectedIC}
              onActivityChange={setSelectedActivity}
              onStateChange={setSelectedState}
              onFyMinChange={setFyMin}
              onFyMaxChange={setFyMax}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            />

            <TermCloud onSearch={handleTermCloudSearch} />

            <div className="results-header">
              <div className="results-meta">
                {loading ? (
                  <span>Searching…</span>
                ) : (
                  <span>
                    <strong>{visibleTotal.toLocaleString()}</strong> results
                    {total > visibleTotal ? ` out of ${total.toLocaleString()}` : ""}
                    {query ? ` for "${query}"` : ""}
                    {projectTermFilters.length > 0 && (
                      <span className="results-meta__term-filters">
                        {" — "}
                        {projectTermFilters.map((term) => (
                          <span key={term} className="results-meta__term-chip">
                            {term}
                            <button
                              type="button"
                              className="results-meta__term-chip-x"
                              onClick={() =>
                                setProjectTermFilters((prev) => prev.filter((t) => t !== term))
                              }
                              aria-label={`Remove ${term} filter`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          className="results-meta__clear-terms"
                          onClick={() => setProjectTermFilters([])}
                        >
                          Clear all
                        </button>
                      </span>
                    )}
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
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageNumbers={pageNumbers}
                onPageChange={setCurrentPage}
                jumpToPageInput={jumpToPageInput}
                onJumpToPageInputChange={setJumpToPageInput}
                onJumpToPageSubmit={handleJumpToPageSubmit}
              />
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
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
