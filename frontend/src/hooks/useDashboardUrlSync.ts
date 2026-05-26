import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { filterBreadcrumbOrderFromSearchParams } from "../utils/filterBreadcrumbOrder";
import type { FilterBreadcrumbKey } from "../utils/filterBreadcrumbOrder";
import {
  buildDashboardUrlParams,
  isDashboardPath,
  parseSearchUrlParams,
  searchLocationsEqual,
  searchParamsToString,
  unifiedSearchFromParsed,
} from "../utils/searchUrlParams";

export type DashboardUrlSyncState = {
  q: string;
  pi: string;
  ic: string;
  org: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
  semanticMode: boolean;
  semanticCommitted: boolean;
};

export type DashboardUrlSyncSetters = {
  setQ: (q: string) => void;
  setPi: (pi: string) => void;
  setIc: (ic: string) => void;
  setOrg: (org: string) => void;
  setActivity: (activity: string) => void;
  setState: (state: string) => void;
  setFyMin: (fyMin: string) => void;
  setFyMax: (fyMax: string) => void;
  setSemanticMode: (enabled: boolean) => void;
  setSemanticCommitted: (committed: boolean) => void;
  setFilterBreadcrumbOrder: (order: FilterBreadcrumbKey[]) => void;
};

type UseDashboardUrlSyncOptions = {
  enabled: boolean;
  state: DashboardUrlSyncState;
  setters: DashboardUrlSyncSetters;
};

export function useDashboardUrlSync({ enabled, state, setters }: UseDashboardUrlSyncOptions): void {
  const location = useLocation();
  const navigate = useNavigate();
  const lastWrittenSearchRef = useRef(location.search);
  const isApplyingFromUrlRef = useRef(false);
  const settersRef = useRef(setters);
  settersRef.current = setters;

  const applySearchToState = useCallback((search: string) => {
    isApplyingFromUrlRef.current = true;
    const urlParams = new URLSearchParams(search);
    const parsed = parseSearchUrlParams(urlParams);
    const s = settersRef.current;
    s.setQ(unifiedSearchFromParsed(parsed));
    s.setPi(parsed.pi);
    s.setIc(parsed.ic);
    s.setOrg(parsed.org);
    s.setActivity(parsed.activity);
    s.setState(parsed.state);
    s.setFyMin(parsed.fyMin);
    s.setFyMax(parsed.fyMax);
    s.setSemanticMode(parsed.semantic);
    s.setSemanticCommitted(parsed.semantic);
    s.setFilterBreadcrumbOrder(filterBreadcrumbOrderFromSearchParams(urlParams));
    lastWrittenSearchRef.current = searchParamsToString(
      buildDashboardUrlParams({
        q: unifiedSearchFromParsed(parsed),
        pi: parsed.pi,
        ic: parsed.ic,
        org: parsed.org,
        activity: parsed.activity,
        state: parsed.state,
        fyMin: parsed.fyMin,
        fyMax: parsed.fyMax,
        semantic: parsed.semantic,
      }),
    );
  }, []);

  useEffect(() => {
    if (!enabled || !isDashboardPath(location.pathname)) return;
    if (searchLocationsEqual(location.search, lastWrittenSearchRef.current)) return;

    applySearchToState(location.search);
  }, [enabled, location.pathname, location.search, applySearchToState]);

  useEffect(() => {
    if (!enabled || !isDashboardPath(location.pathname)) return;
    if (isApplyingFromUrlRef.current) {
      isApplyingFromUrlRef.current = false;
      return;
    }

    const params = buildDashboardUrlParams({
      q: state.q,
      pi: state.pi,
      ic: state.ic,
      org: state.org,
      activity: state.activity,
      state: state.state,
      fyMin: state.fyMin,
      fyMax: state.fyMax,
      semantic: state.semanticMode && state.semanticCommitted,
    });
    const nextSearch = searchParamsToString(params);
    if (searchLocationsEqual(nextSearch, location.search)) {
      lastWrittenSearchRef.current = nextSearch;
      return;
    }

    lastWrittenSearchRef.current = nextSearch;
    navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
  }, [
    enabled,
    location.pathname,
    location.search,
    navigate,
    state.q,
    state.pi,
    state.ic,
    state.org,
    state.activity,
    state.state,
    state.fyMin,
    state.fyMax,
    state.semanticMode,
    state.semanticCommitted,
  ]);
}

export function readInitialDashboardFromWindow(): ReturnType<typeof parseSearchUrlParams> | null {
  if (typeof window === "undefined") return null;
  if (!isDashboardPath(window.location.pathname)) return null;
  return parseSearchUrlParams(new URLSearchParams(window.location.search));
}
