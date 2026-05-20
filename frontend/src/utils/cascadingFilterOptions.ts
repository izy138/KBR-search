import type { FilterSelectOption } from "../components/search/FilterSelect";

const localeSort = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

export function buildCascadingSelectOptions(
  catalogItems: readonly string[],
  available: Set<string> | null,
  selected: string,
  formatLabel: (value: string) => string,
  sortItems = true,
  matchKey: (value: string) => string = (value) => value,
): FilterSelectOption[] {
  const items = sortItems ? [...catalogItems].sort(localeSort) : [...catalogItems];
  if (!available) {
    return items.map((value) => ({ value, label: formatLabel(value) }));
  }

  const enabled: FilterSelectOption[] = [];
  const disabled: FilterSelectOption[] = [];

  for (const value of items) {
    const isAvailable = available.has(matchKey(value));
    const option: FilterSelectOption = {
      value,
      label: formatLabel(value),
      disabled: !isAvailable,
    };
    if (!isAvailable && value === selected) {
      option.disabled = false;
    }
    if (option.disabled) {
      disabled.push(option);
    } else {
      enabled.push(option);
    }
  }

  if (sortItems) {
    enabled.sort((a, b) => localeSort(a.label, b.label));
    disabled.sort((a, b) => localeSort(a.label, b.label));
  }

  return [...enabled, ...disabled];
}
