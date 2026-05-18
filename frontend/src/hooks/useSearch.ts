import { useCallback, useEffect, useState } from "react";
import {
  searchProjects,
  type SearchResultRecord,
  type SearchSortDirection,
  type SearchSortField,
} from "../api";

export type UseSearchParams = {
  query: string;
  setQuery: (q: string) => void;
  selectedPI: string;
  selectedIC: string;
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
  /** Set to false when on dashboard, project detail, investigator, or semantic views. */
  enabled: boolean;
};

export type UseSearchReturn = {
  projectTermFilters: string[];
  setProjectTermFilters: React.Dispatch<React.SetStateAction<string[]>>;
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
  selectedPI,
  selectedIC,
  selectedActivity,
  selectedState,
  fyMin,
  fyMax,
  currentPage,
  resultsPerPage,
  sortBy,
  sortOrder,
  enabled,
}: UseSearchParams): UseSearchReturn {
  const [projectTermFilters, setProjectTermFilters] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [visibleTotal, setVisibleTotal] = useState(0);

  const runSearch = useCallback(
    async (q: string, page: number, limit: number) => {
      setLoading(true);
      try {
        const payload = await searchProjects(q, {
          page,
          limit,
          pi: selectedPI,
          ic: selectedIC,
          activity: selectedActivity,
          state: selectedState,
          fyMin,
          fyMax,
          projectTerms: projectTermFilters,
          sortBy,
          sortOrder,
        });
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
        setVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedPI,
      selectedIC,
      selectedActivity,
      selectedState,
      fyMin,
      fyMax,
      projectTermFilters,
      sortBy,
      sortOrder,
    ],
  );

  useEffect(() => {
    if (!enabled) return;
    void runSearch(query, currentPage, resultsPerPage);
  }, [
    enabled,
    query,
    projectTermFilters,
    currentPage,
    resultsPerPage,
    runSearch,
    selectedPI,
    selectedIC,
    selectedActivity,
    selectedState,
    fyMin,
    fyMax,
    sortBy,
    sortOrder,
  ]);

  return {
    projectTermFilters,
    setProjectTermFilters,
    results,
    loading,
    total,
    visibleTotal,
  };
}
