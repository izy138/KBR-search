import type { AnalyticsFilterOptions } from "../api";
import type { FilterValues } from "../types/filters";
import {
  hasAdvancedSearchContent,
  normalizeAdvancedSearchQuery,
  parseUnifiedSearch,
} from "./advancedSearch";

export function toAnalyticsFilterOptions(
  filters: FilterValues,
  searchQuery = "",
): AnalyticsFilterOptions {
  const options: AnalyticsFilterOptions = {
    pi: filters.pi || undefined,
    ic: filters.ic || undefined,
    org: filters.org || undefined,
    activity: filters.activity || undefined,
    state: filters.state || undefined,
    fyMin: filters.fyMin || undefined,
    fyMax: filters.fyMax || undefined,
  };
  const { plainQ, advanced } = parseUnifiedSearch(searchQuery);
  const trimmedPlain = plainQ.trim();
  if (trimmedPlain) {
    options.q = trimmedPlain;
  }
  if (advanced && hasAdvancedSearchContent(advanced)) {
    options.advancedSearch = normalizeAdvancedSearchQuery(advanced);
  }
  return options;
}

/** Facet filters only (no keyword/advanced) for cascading dropdown availability. */
export function toFacetAvailabilityFilterOptions(filters: FilterValues): AnalyticsFilterOptions {
  const pi = filters.pi.trim();
  return {
    pi: pi || undefined,
    ic: filters.ic || undefined,
    org: filters.org || undefined,
    activity: filters.activity || undefined,
    state: filters.state || undefined,
    fyMin: filters.fyMin || undefined,
    fyMax: filters.fyMax || undefined,
  };
}
