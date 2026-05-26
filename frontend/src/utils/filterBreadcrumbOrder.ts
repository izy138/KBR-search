import type { FilterValues } from "../types/filters";

export type FilterBreadcrumbKey = "state" | "ic" | "org" | "activity";

const FILTER_BREADCRUMB_KEYS: FilterBreadcrumbKey[] = ["state", "ic", "org", "activity"];

function isBreadcrumbFilterActive(filters: FilterValues, key: FilterBreadcrumbKey): boolean {
  return filters[key].trim() !== "";
}

export function updateFilterBreadcrumbOrder(
  prevOrder: FilterBreadcrumbKey[],
  prevFilters: FilterValues,
  nextFilters: FilterValues,
): FilterBreadcrumbKey[] {
  let order = prevOrder.filter((key) => isBreadcrumbFilterActive(nextFilters, key));

  for (const key of FILTER_BREADCRUMB_KEYS) {
    const wasActive = isBreadcrumbFilterActive(prevFilters, key);
    const isActive = isBreadcrumbFilterActive(nextFilters, key);
    if (!wasActive && isActive && !order.includes(key)) {
      order = [...order, key];
    }
  }

  return order;
}

export function getActiveFilterBreadcrumbKeys(
  filters: FilterValues,
  order: FilterBreadcrumbKey[],
): FilterBreadcrumbKey[] {
  return order.filter((key) => isBreadcrumbFilterActive(filters, key));
}

export function buildFilterBreadcrumbSegments(
  filters: FilterValues,
  order: FilterBreadcrumbKey[],
): string[] {
  return getActiveFilterBreadcrumbKeys(filters, order).map((key) => {
    const value = filters[key].trim();
    return key === "state" ? value.toUpperCase() : value;
  });
}

/** Keeps filters through `segmentIndex` (in selection order); clears later selections. */
export function filtersKeepingBreadcrumbThroughIndex(
  filters: FilterValues,
  order: FilterBreadcrumbKey[],
  segmentIndex: number,
): FilterValues {
  const activeKeys = getActiveFilterBreadcrumbKeys(filters, order);
  const keysToClear =
    segmentIndex < 0 ? activeKeys : activeKeys.slice(segmentIndex + 1);
  const next = { ...filters };
  for (const key of keysToClear) {
    next[key] = "";
  }
  return next;
}
