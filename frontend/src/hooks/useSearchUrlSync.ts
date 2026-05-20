import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SearchSortDirection, SearchSortField } from "../api";
import type { SortState as ResultsSortState } from "../components/search/ResultsList";
import {
  buildSearchUrlParams,
  isSearchPath,
  parseSearchUrlParams,
  searchLocationsEqual,
  searchParamsToString,
  unifiedSearchFromParsed,
  type SortOption,
} from "../utils/searchUrlParams";

export type SearchUrlSyncState = {
  /** Unified search bar text (parenthesized advanced terms + plain keywords). */
  q: string;
  page: number;
  limit: number;
  pi: string;
  ic: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
  projectTerms: string[];
  sortBy: SearchSortField | "";
  sortOrder: SearchSortDirection;
  sortOption: SortOption;
  columnSort: ResultsSortState;
  semanticMode: boolean;
  semanticCommitted: boolean;
};

export type SearchUrlSyncSetters = {
  setQ: (q: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setPi: (pi: string) => void;
  setIc: (ic: string) => void;
  setActivity: (activity: string) => void;
  setState: (state: string) => void;
  setFyMin: (fyMin: string) => void;
  setFyMax: (fyMax: string) => void;
  setProjectTerms: (terms: string[]) => void;
  setSortOption: (option: SortOption) => void;
  setColumnSort: (sort: ResultsSortState) => void;
  setSemanticMode: (enabled: boolean) => void;
  setSemanticCommitted: (committed: boolean) => void;
};

type UseSearchUrlSyncOptions = {
  enabled: boolean;
  state: SearchUrlSyncState;
  setters: SearchUrlSyncSetters;
};

export function useSearchUrlSync({ enabled, state, setters }: UseSearchUrlSyncOptions): {
  navigateToSearch: (overrides?: Partial<SearchUrlSyncState>) => void;
  lastSearchHref: string;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const lastWrittenSearchRef = useRef(location.search);
  const isApplyingFromUrlRef = useRef(false);
  const lastSearchHrefRef = useRef("/search");
  const settersRef = useRef(setters);
  settersRef.current = setters;

  const applyParsedToState = useCallback((parsed: ReturnType<typeof parseSearchUrlParams>) => {
    isApplyingFromUrlRef.current = true;
    const s = settersRef.current;
    s.setQ(unifiedSearchFromParsed(parsed));
    s.setPage(parsed.page);
    s.setLimit(parsed.limit);
    s.setPi(parsed.pi);
    s.setIc(parsed.ic);
    s.setActivity(parsed.activity);
    s.setState(parsed.state);
    s.setFyMin(parsed.fyMin);
    s.setFyMax(parsed.fyMax);
    s.setProjectTerms(parsed.projectTerms);
    s.setSortOption(parsed.sortOption);
    s.setColumnSort(parsed.columnSort);
    s.setSemanticMode(parsed.semantic);
    s.setSemanticCommitted(parsed.semantic);
    lastWrittenSearchRef.current = searchParamsToString(
      buildSearchUrlParams({
        q: unifiedSearchFromParsed(parsed),
        page: parsed.page,
        limit: parsed.limit,
        pi: parsed.pi,
        ic: parsed.ic,
        activity: parsed.activity,
        state: parsed.state,
        fyMin: parsed.fyMin,
        fyMax: parsed.fyMax,
        projectTerms: parsed.projectTerms,
        sortBy: parsed.sortBy,
        sortOrder: parsed.sortOrder,
        semantic: parsed.semantic,
      }),
    );
  }, []);

  useEffect(() => {
    if (!enabled || !isSearchPath(location.pathname)) return;
    if (searchLocationsEqual(location.search, lastWrittenSearchRef.current)) return;

    const parsed = parseSearchUrlParams(new URLSearchParams(location.search));
    applyParsedToState(parsed);
  }, [enabled, location.pathname, location.search, applyParsedToState]);

  useEffect(() => {
    if (!enabled || !isSearchPath(location.pathname)) return;
    if (isApplyingFromUrlRef.current) {
      isApplyingFromUrlRef.current = false;
      return;
    }

    const params = buildSearchUrlParams({
      q: state.q,
      page: state.page,
      limit: state.limit,
      pi: state.pi,
      ic: state.ic,
      activity: state.activity,
      state: state.state,
      fyMin: state.fyMin,
      fyMax: state.fyMax,
      projectTerms: state.projectTerms,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      semantic: state.semanticMode && state.semanticCommitted,
    });
    const nextSearch = searchParamsToString(params);
    if (searchLocationsEqual(nextSearch, location.search)) {
      lastWrittenSearchRef.current = nextSearch;
      lastSearchHrefRef.current = `/search${nextSearch}`;
      return;
    }

    lastWrittenSearchRef.current = nextSearch;
    lastSearchHrefRef.current = `/search${nextSearch}`;
    navigate({ pathname: "/search", search: nextSearch }, { replace: true });
  }, [
    enabled,
    location.pathname,
    location.search,
    navigate,
    state.q,
    state.page,
    state.limit,
    state.pi,
    state.ic,
    state.activity,
    state.state,
    state.fyMin,
    state.fyMax,
    state.projectTerms,
    state.sortBy,
    state.sortOrder,
    state.semanticMode,
    state.semanticCommitted,
  ]);

  const navigateToSearch = useCallback(
    (overrides?: Partial<SearchUrlSyncState>) => {
      const merged = { ...state, ...overrides };
      const params = buildSearchUrlParams({
        q: merged.q,
        page: merged.page,
        limit: merged.limit,
        pi: merged.pi,
        ic: merged.ic,
        activity: merged.activity,
        state: merged.state,
        fyMin: merged.fyMin,
        fyMax: merged.fyMax,
        projectTerms: merged.projectTerms,
        sortBy: merged.sortBy,
        sortOrder: merged.sortOrder,
        semantic: merged.semanticMode && merged.semanticCommitted,
      });
      const search = searchParamsToString(params);
      lastWrittenSearchRef.current = search;
      lastSearchHrefRef.current = `/search${search}`;
      navigate({ pathname: "/search", search });
    },
    [navigate, state],
  );

  return {
    navigateToSearch,
    lastSearchHref: lastSearchHrefRef.current,
  };
}

export function readInitialSearchFromWindow(): ReturnType<typeof parseSearchUrlParams> | null {
  if (typeof window === "undefined") return null;
  if (!isSearchPath(window.location.pathname)) return null;
  return parseSearchUrlParams(new URLSearchParams(window.location.search));
}
