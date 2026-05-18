import {
  type ChangeEvent,
  type FormEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "./hooks/useTheme";
import { useProjectDetails } from "./hooks/useProjectDetails";
import { useInvestigatorProjects, INVESTIGATOR_PER_PAGE } from "./hooks/useInvestigatorProjects";
import { useSearch } from "./hooks/useSearch";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import type { DashboardSearchFilters } from "./components/dashboard/Dashboard";
import Filters from "./components/search/Filters";
import InvestigatorPage from "./components/investigator/InvestigatorPage";
import ResultsList from "./components/search/ResultsList";
import Pagination, { getPageNumbers } from "./components/shared/Pagination";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { type SearchResultRecord } from "./api";
import { useFilterCatalog } from "./hooks/useFilterCatalog";
import type { FilterValues } from "./types/filters";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const ProjectDetailsPage = lazy(() => import("./components/project/ProjectDetailsPage"));
const SemanticVectorLabPage = lazy(() => import("./components/semantic/SemanticVectorLabPage"));
const SemanticSimilarProjectPage = lazy(() => import("./components/semantic/SemanticSimilarProjectPage"));

export default function App() {
  type SortOption = "relevant" | "alphaAsc" | "alphaDesc";

  const [selectedPI, setSelectedPI] = useState("");
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");

  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToPageInput, setJumpToPageInput] = useState("1");
  const [sortOption, setSortOption] = useState<SortOption>("relevant");
  const [investigatorPage, setInvestigatorPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, handleThemeToggle } = useTheme();

  const isDashboardRoute =
    location.pathname === "/"
    || location.pathname === "/dashboard"
    || location.pathname === "/dashboard/";
  const isSearchRoute =
    location.pathname === "/search" || location.pathname === "/search/";
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
    isSearchRoute
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

  const searchFilterCatalog = useFilterCatalog();

  const appliedFilters = useMemo<FilterValues>(
    () => ({
      pi: selectedPI,
      ic: selectedIC,
      activity: selectedActivity,
      state: selectedState,
      fyMin,
      fyMax,
    }),
    [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax],
  );

  const filterCatalog = useMemo(
    () => ({
      icNames: searchFilterCatalog?.icNames ?? [],
      activityCodes: searchFilterCatalog?.activityCodes ?? [],
      states: searchFilterCatalog?.states ?? [],
      fiscalYearOptions: searchFilterCatalog?.fiscalYearOptions,
    }),
    [searchFilterCatalog],
  );

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

  const handleApplyFilters = (filters: FilterValues) => {
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
      navigate("/search");
    },
    [navigate, setQuery, setProjectTermFilters],
  );

  const handleDashboardTermSearchNavigate = useCallback(
    (terms: string[], filters: DashboardSearchFilters) => {
      setSelectedPI(filters.pi);
      setSelectedIC(filters.ic);
      setSelectedActivity(filters.activity);
      setSelectedState(filters.state);
      setFyMin(filters.fyMin);
      setFyMax(filters.fyMax);
      setProjectTermFilters(terms);
      setCurrentPage(1);
      navigate("/search");
    },
    [navigate, setProjectTermFilters],
  );

  const handleSearchFromProjectTerms = useCallback(
    (payload: { terms: string[]; additionalQuery: string }) => {
      setProjectTermFilters(payload.terms);
      setQuery(payload.additionalQuery.trim());
      setCurrentPage(1);
      navigate("/search");
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

  const isDashboardVisible = view === "dashboard" && !isSemanticRoute;

  return (
    <div className="grid grid-rows-[auto_minmax(0,1fr)] h-full overflow-hidden font-sans">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 h-[50px] bg-surface border-b border-border gap-4 max-[900px]:h-[60px] max-[900px]:px-4">
        <button
          type="button"
          className="flex items-center gap-[0.4rem] font-semibold text-[15px] text-text-primary bg-transparent border-none cursor-pointer tracking-[0.01em] shrink-0 justify-self-start hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          onClick={() => navigate("/")}
          aria-label="Return to dashboard"
        >
          <div className="w-[9px] h-[9px] rounded-full bg-accent" />
          NIH Project Search
        </button>
        <nav className="flex items-center justify-center gap-1" aria-label="Main navigation">
          <button
            type="button"
            className={
              "px-3 py-[0.35rem] rounded-sm border-none font-sans text-[13px] font-medium cursor-pointer transition-[color,background] duration-150 hover:text-text-primary hover:bg-surface-hover" +
              (view === "dashboard" && !isSemanticRoute
                ? " text-accent-text bg-accent-light"
                : " bg-transparent text-text-muted")
            }
            onClick={() => navigate("/")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={
              "px-3 py-[0.35rem] rounded-sm border-none font-sans text-[13px] font-medium cursor-pointer transition-[color,background] duration-150 hover:text-text-primary hover:bg-surface-hover" +
              ((isSearchRoute || selectedProjectId || selectedInvestigatorName) && !isSemanticRoute
                ? " text-accent-text bg-accent-light"
                : " bg-transparent text-text-muted")
            }
            onClick={() => navigate("/search")}
          >
            Search
          </button>
          <button
            type="button"
            className={
              "px-3 py-[0.35rem] rounded-sm border-none font-sans text-[13px] font-medium cursor-pointer transition-[color,background] duration-150 hover:text-text-primary hover:bg-surface-hover" +
              (isSemanticRoute
                ? " text-accent-text bg-accent-light"
                : " bg-transparent text-text-muted")
            }
            onClick={() => navigate("/semantic")}
          >
            Vector lab
          </button>
        </nav>

        <div className="flex items-center justify-end gap-3 max-[900px]:gap-2">
          <button
            className="flex items-center gap-[0.4rem] px-[0.65rem] py-[0.3rem] rounded-sm bg-surface-hover border border-border text-text-secondary font-sans text-[12px] font-medium cursor-pointer transition-[color,border-color,background] duration-150 hover:border-border-strong hover:text-text-primary hover:bg-surface max-[900px]:hidden"
            type="button"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "Dark mode" : "Light mode"}
            <span className="text-sm" aria-hidden="true">
              {theme === "light" ? "🌙" : "☀️"}
            </span>
          </button>

          <div className="flex items-center gap-2 max-[900px]:gap-1" aria-label="Partner logos">
            <img
              src="/Images/KBR_logo.svg"
              alt="KBR logo"
              className="object-contain h-[28px] max-[900px]:h-5"
            />
            <img
              src="/Images/FIU_logo.svg.png"
              alt="FIU logo"
              className="object-contain h-[20px] max-[900px]:h-6 mt-2"
            />
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className={
          "min-h-0 overflow-y-auto" +
          (isDashboardVisible ? "" : " p-[1.1rem_1.5rem] max-[900px]:px-3 max-[900px]:py-3")
        }
      >
        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted text-[0.92rem]" role="status">
              <span className="text-text-secondary text-sm">Loading…</span>
            </div>
          }>
            {isDashboardVisible ? (
              <Dashboard
                onSearchNavigate={handleDashboardSearchNavigate}
                onTermSearchNavigate={handleDashboardTermSearchNavigate}
              />
            ) : semanticSimilarProjectId ? (
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
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted text-[0.92rem]" role="status" aria-live="polite">
                  <strong className="text-text-secondary text-[15px]">Loading project…</strong>
                </div>
              ) : projectError ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted text-[0.92rem]" role="status" aria-live="polite">
                  <strong className="text-text-secondary text-[15px]">{projectError}</strong>
                  <button
                    type="button"
                    className="inline-block p-0 border-none bg-transparent text-accent font-sans text-[15.5px] cursor-pointer hover:underline"
                    onClick={() => navigate("/search")}
                    style={{ marginTop: "0.85rem" }}
                  >
                    Back to results
                  </button>
                </div>
              ) : selectedProject ? (
                <ProjectDetailsPage
                  item={selectedProject}
                  onBack={() => navigate("/search")}
                  onOpenInvestigator={handleOpenInvestigator}
                  onOpenDetails={handleOpenDetails}
                  onSearchWithProjectTerms={handleSearchFromProjectTerms}
                />
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted text-[0.92rem]" role="status" aria-live="polite">
                  <strong className="text-text-secondary text-[15px]">Project not found</strong>
                  <button
                    type="button"
                    className="inline-block p-0 border-none bg-transparent text-accent font-sans text-[15.5px] cursor-pointer hover:underline"
                    onClick={() => navigate("/search")}
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
                onBack={() => navigate("/search")}
              />
            ) : isSearchRoute ? (
              <>
                <Filters
                  applied={appliedFilters}
                  catalog={filterCatalog}
                  searchQuery={query}
                  onSearch={handleSearch}
                  onApply={handleApplyFilters}
                  onClear={handleClearFilters}
                />

                <div className="flex items-center justify-between pt-2 pl-1 gap-4 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-2">
                  <div className="text-text-secondary text-sm pt-[0.35rem]">
                    {loading ? (
                      <span>Searching…</span>
                    ) : (
                      <span>
                        <strong className="text-text-primary font-medium">{visibleTotal.toLocaleString()}</strong> results
                        {total > visibleTotal ? ` out of ${total.toLocaleString()}` : ""}
                        {query ? ` for "${query}"` : ""}
                        {projectTermFilters.length > 0 && (
                          <span className="inline-flex flex-wrap items-center gap-[0.3rem] align-middle">
                            {" — "}
                            {projectTermFilters.map((term) => (
                              <span key={term} className="inline-flex items-center gap-[0.2rem] px-[0.45rem] py-[0.15rem] rounded-[--radius-sm] bg-accent-light text-accent-text text-[0.78rem] font-medium">
                                {term}
                                <button
                                  type="button"
                                  className="bg-transparent border-none text-accent-text cursor-pointer text-[0.85rem] px-[0.15rem] py-0 leading-none opacity-70 hover:opacity-100"
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
                              className="bg-transparent border-none text-accent-text cursor-pointer text-[0.78rem] underline px-[0.25rem] py-[0.15rem]"
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

                  <div className="flex items-center gap-2 pb-[0.15rem] max-[900px]:w-full max-[900px]:justify-between">
                    <select
                      className="px-[0.56rem] py-[0.3rem] border border-border rounded-sm bg-surface font-sans text-xs text-text-secondary cursor-pointer outline-none"
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as SortOption)}
                      aria-label="Sort results"
                    >
                      <option value="relevant">Most Relevant</option>
                      <option value="alphaAsc">Title: A to Z</option>
                      <option value="alphaDesc">Title: Z to A</option>
                    </select>
                    <select
                      className="px-[0.56rem] py-[0.3rem] border border-border rounded-sm bg-surface font-sans text-xs text-text-secondary cursor-pointer outline-none"
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
                    className="fixed right-8 bottom-6 border border-accent bg-accent text-white rounded-sm px-[0.92rem] py-[0.575rem] font-sans text-[15px] font-medium cursor-pointer shadow-md transition-[background,transform] duration-150 hover:bg-accent-hover hover:-translate-y-0.5 max-[900px]:right-4 max-[900px]:bottom-3"
                    onClick={handleScrollToTop}
                    aria-label="Scroll back to top"
                  >
                    ↑
                  </button>
                )}
              </>
            ) : null}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
