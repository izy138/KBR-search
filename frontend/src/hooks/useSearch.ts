import { useCallback, useEffect, useRef, useState } from "react";
import {
  searchProjects,
  searchSimilarByText,
  type SearchResultRecord,
  type SearchSortDirection,
  type SearchSortField,
} from "../api";
import { parseUnifiedSearch } from "../utils/advancedSearch";

const SEMANTIC_SEARCH_MAX_K = 50;

export type UseSearchParams = {
  query: string;
  setQuery: (q: string) => void;
  projectTermFilters: string[];
  excludeProjectTermFilters: string[];
  selectedPI: string;
  selectedIC: string;
  selectedOrg: string;
  selectedActivity: string;
  selectedState: string;
  fyMin: string;
  fyMax: string;
  currentPage: number;
  resultsPerPage: number;
  /**
   * Empty string means "no sort" (OpenSearch returns results in relevance/index
   * order). When set, the backend sorts the full result set before pagination
   * so column sorts span all pages rather than only the visible one.
   */
  sortBy: SearchSortField | "";
  sortOrder: SearchSortDirection;
  /** Checkbox on — UI only until a search is submitted. */
  semanticMode: boolean;
  /** True after the user runs a search while semantic mode is on. */
  semanticSearchCommitted: boolean;
  /** Set to false when on dashboard, project detail, investigator, or semantic views. */
  enabled: boolean;
};

export type UseSearchReturn = {
  results: SearchResultRecord[];
  loading: boolean;
  total: number;
  visibleTotal: number;
};

/**
 * Encapsulates all full-text search state and the fetch lifecycle.
 *
 * Accepts filter values as explicit parameters so it can read them directly,
 * eliminating the `searchFiltersRef` workaround that was required when these
 * values lived in a parent component and could not be listed as `useCallback`
 * dependencies without triggering excessive re-renders.
 *
 * The effect is a no-op when `enabled` is false, so callers on non-search
 * routes pay zero fetch cost.
 */
export function useSearch({
  query,
  setQuery,
  projectTermFilters,
  excludeProjectTermFilters,
  selectedPI,
  selectedIC,
  selectedOrg,
  selectedActivity,
  selectedState,
  fyMin,
  fyMax,
  currentPage,
  resultsPerPage,
  sortBy,
  sortOrder,
  semanticMode,
  semanticSearchCommitted,
  enabled,
}: UseSearchParams): UseSearchReturn {
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [visibleTotal, setVisibleTotal] = useState(0);

  const fetchContextRef = useRef({
    semanticMode,
    semanticSearchCommitted,
    selectedPI,
    selectedIC,
    selectedOrg,
    selectedActivity,
    selectedState,
    fyMin,
    fyMax,
    projectTermFilters,
    excludeProjectTermFilters,
    sortBy,
    sortOrder,
  });
  fetchContextRef.current = {
    semanticMode,
    semanticSearchCommitted,
    selectedPI,
    selectedIC,
    selectedOrg,
    selectedActivity,
    selectedState,
    fyMin,
    fyMax,
    projectTermFilters,
    excludeProjectTermFilters,
    sortBy,
    sortOrder,
  };

  const runSearch = useCallback(async (q: string, page: number, limit: number) => {
      const ctx = fetchContextRef.current;
      const useSemanticApi = ctx.semanticMode && ctx.semanticSearchCommitted;

      setLoading(true);
      try {
        if (useSemanticApi) {
          const trimmed = q.trim();
          if (!trimmed) {
            setResults([]);
            setTotal(0);
            setVisibleTotal(0);
            return;
          }
          const payload = await searchSimilarByText(trimmed, SEMANTIC_SEARCH_MAX_K);
          const allResults = payload.results ?? [];
          const start = (page - 1) * limit;
          setResults(allResults.slice(start, start + limit));
          setTotal(allResults.length);
          setVisibleTotal(allResults.length);
          return;
        }

        const { plainQ, advanced } = parseUnifiedSearch(q);
        const payload = await searchProjects(plainQ, {
          page,
          limit,
          pi: ctx.selectedPI,
          ic: ctx.selectedIC,
          org: ctx.selectedOrg,
          activity: ctx.selectedActivity,
          state: ctx.selectedState,
          fyMin: ctx.fyMin,
          fyMax: ctx.fyMax,
          projectTerms: ctx.projectTermFilters,
          excludeProjectTerms: ctx.excludeProjectTermFilters,
          advancedSearch: advanced,
          sortBy: ctx.sortBy,
          sortOrder: ctx.sortOrder,
        });
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
        setVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const { semanticMode: modeOn, semanticSearchCommitted: committed } = fetchContextRef.current;
    if (modeOn && !committed) return;
    void runSearch(query, currentPage, resultsPerPage);
  }, [
    enabled,
    query,
    semanticSearchCommitted,
    projectTermFilters,
    excludeProjectTermFilters,
    currentPage,
    resultsPerPage,
    selectedPI,
    selectedIC,
    selectedOrg,
    selectedActivity,
    selectedState,
    fyMin,
    fyMax,
    sortBy,
    sortOrder,
    runSearch,
  ]);

  return {
    results,
    loading,
    total,
    visibleTotal,
  };
}
