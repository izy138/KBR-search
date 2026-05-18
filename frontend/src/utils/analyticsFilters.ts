import type { AnalyticsFilterOptions } from "../api";
import type { FilterValues } from "../types/filters";

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
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) {
    options.q = trimmedQuery;
  }
  return options;
}
