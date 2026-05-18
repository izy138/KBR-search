export type FilterValues = {
  pi: string;
  ic: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
};

export const emptyFilterValues = (): FilterValues => ({
  pi: "",
  ic: "",
  activity: "",
  state: "",
  fyMin: "",
  fyMax: "",
});

export const hasActiveFilters = (filters: FilterValues): boolean =>
  Boolean(filters.pi || filters.ic || filters.activity || filters.state || filters.fyMin || filters.fyMax);

export const normalizeFiltersOnApply = (
  draft: FilterValues,
  fyChoices: readonly number[],
): FilterValues => {
  let fyMin = draft.fyMin.trim();
  let fyMax = draft.fyMax.trim();

  if (!fyMin && !fyMax && fyChoices.length > 0) {
    fyMin = String(fyChoices[0]);
    fyMax = String(fyChoices[fyChoices.length - 1]);
  }

  const nMin = fyMin ? Number.parseInt(fyMin, 10) : Number.NaN;
  const nMax = fyMax ? Number.parseInt(fyMax, 10) : Number.NaN;
  if (Number.isFinite(nMin) && Number.isFinite(nMax) && nMin > nMax) {
    return { ...draft, fyMin: String(nMax), fyMax: String(nMin) };
  }

  return { ...draft, fyMin, fyMax };
};
