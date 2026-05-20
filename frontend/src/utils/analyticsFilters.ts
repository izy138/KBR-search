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
