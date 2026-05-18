import { type FC, useEffect, useMemo, useState } from "react";
import type { AdvancedSearchQuery } from "../../types/advancedSearch";
import {
  createDefaultAdvancedSearchQuery,
  formatAdvancedSearchQuery,
  hasAdvancedSearchContent,
} from "../../utils/advancedSearch";
import { cn } from "../../utils/cn";
import AdvancedSearchModal from "./AdvancedSearchModal";

type SearchBarProps = {
  onSearch: (query: string) => void;
  onAdvancedSearch?: (query: AdvancedSearchQuery) => void;
  advancedSearch?: AdvancedSearchQuery | null;
  onExitAdvancedSearch?: () => void;
  /** When set, shows a green "Update Dashboard" submit button; Search becomes a navigate action. */
  onUpdateDashboard?: (query: string) => void;
  initialQuery?: string;
  /** When false, × only clears the input (no callback). Default true. */
  submitOnClear?: boolean;
  /** When false, hides the advanced-search toggle (e.g. dashboard keyword bar). */
  showAdvancedToggle?: boolean;
};

const SearchBar: FC<SearchBarProps> = ({
  onSearch,
  onAdvancedSearch,
  advancedSearch = null,
  onExitAdvancedSearch,
  onUpdateDashboard,
  initialQuery = "",
  submitOnClear = true,
  showAdvancedToggle = true,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isDashboardMode = onUpdateDashboard != null;
  const advancedActive = advancedSearch != null && hasAdvancedSearchContent(advancedSearch);
  const advancedSummary = useMemo(
    () => (advancedSearch ? formatAdvancedSearchQuery(advancedSearch) : ""),
    [advancedSearch],
  );

  useEffect(() => {
    if (!advancedActive) {
      setQuery(initialQuery);
    }
  }, [initialQuery, advancedActive]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (advancedActive) {
      return;
    }
    if (isDashboardMode) {
      onUpdateDashboard(query.trim());
    } else {
      onSearch(query.trim());
    }
  };

  const handleSearchClick = () => {
    if (advancedActive) {
      return;
    }
    onSearch(query.trim());
  };

  const handleClear = () => {
    if (advancedActive) {
      onExitAdvancedSearch?.();
      setQuery("");
      if (!submitOnClear) return;
      onSearch("");
      return;
    }
    setQuery("");
    if (!submitOnClear) return;
    if (isDashboardMode) {
      onUpdateDashboard("");
    } else {
      onSearch("");
    }
  };

  const handleAdvancedSubmit = (nextQuery: AdvancedSearchQuery) => {
    onAdvancedSearch?.(nextQuery);
  };

  const handleAdvancedToggle = () => {
    if (advancedActive) {
      onExitAdvancedSearch?.();
      return;
    }
    setAdvancedOpen(true);
  };

  const modalInitialQuery = advancedSearch ?? createDefaultAdvancedSearchQuery(query.trim());

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-bg px-2 py-[0.3rem] transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(26,86,219,0.1)]"
      >
        <svg
          className="h-4 w-4 shrink-0 text-text-muted"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent py-[0.52rem] font-sans text-[14px] text-text-primary outline-none placeholder:text-text-muted",
            advancedActive && "cursor-default text-text-secondary",
          )}
          placeholder={
            advancedActive
              ? "Advanced search active"
              : "Search NIH projects by title, PI, keywords…"
          }
          value={advancedActive ? advancedSummary : query}
          readOnly={advancedActive}
          onClick={() => {
            if (advancedActive) {
              setAdvancedOpen(true);
            }
          }}
          onChange={(e) => {
            if (!advancedActive) {
              setQuery(e.target.value);
            }
          }}
        />
        {advancedActive || query ? (
          <button
            type="button"
            onClick={handleClear}
            className="cursor-pointer border-none bg-transparent px-0.5 text-[19px] leading-none text-text-muted"
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
        {showAdvancedToggle && onAdvancedSearch != null ? (
          <button
            type="button"
            onClick={handleAdvancedToggle}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-sm border px-[0.65rem] py-[0.38rem] font-sans text-[12px] font-medium transition-colors duration-150",
              advancedActive
                ? "border-accent bg-accent-light text-accent-text hover:bg-accent-light"
                : "border-border bg-bg text-text-secondary hover:border-border-strong hover:text-text-primary",
            )}
          >
            {advancedActive ? "Simple" : "Advanced"}
          </button>
        ) : null}
        {isDashboardMode ? (
          <>
            <button
              type="submit"
              className="cursor-pointer whitespace-nowrap rounded-sm border-none bg-green px-[0.75rem] py-[0.38rem] font-sans text-sm font-medium text-white transition-colors duration-150 hover:brightness-110"
            >
              Update Dashboard
            </button>
            <button
              type="button"
              onClick={handleSearchClick}
              className="cursor-pointer whitespace-nowrap rounded-sm border-none bg-accent px-[0.9rem] py-[0.38rem] font-sans text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
            >
              Search
            </button>
          </>
        ) : (
          <button
            type="submit"
            className="cursor-pointer whitespace-nowrap rounded-sm border-none bg-accent px-[0.9rem] py-[0.38rem] font-sans text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            Search
          </button>
        )}
      </form>
      {showAdvancedToggle && onAdvancedSearch != null ? (
        <AdvancedSearchModal
          open={advancedOpen}
          initialQuery={modalInitialQuery}
          onClose={() => setAdvancedOpen(false)}
          onSubmit={handleAdvancedSubmit}
        />
      ) : null}
    </>
  );
};

export default SearchBar;
