/** Default FY choices when catalog does not provide fiscal years (e.g. search view). */
export const DEFAULT_FISCAL_YEAR_OPTIONS: readonly number[] = [2020, 2021, 2022, 2023, 2024, 2025];

/** Empty FY selection in dropdowns; Apply may map to full catalog range. */
export const FY_RANGE_PLACEHOLDER = "-";

export const formatDropdownLabel = (value: string): string => {
  const titleCase = value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (titleCase.startsWith("National Institute Of")) {
    return titleCase.replace("National Institute Of", "Nat. Inst. of");
  }

  if (titleCase.startsWith("National Institute")) {
    return titleCase.replace("National Institute", "Nat. Inst.");
  }

  if (titleCase.startsWith("National")) {
    return titleCase.replace("National", "Nat.");
  }

  return titleCase;
};

export const formatAllCapsLabel = (value: string): string => value.trim().toUpperCase();

export const resolveFiscalYearChoices = (fiscalYearOptions?: number[]): number[] => {
  if (fiscalYearOptions && fiscalYearOptions.length > 0) {
    return [...new Set(fiscalYearOptions)].sort((a, b) => a - b);
  }
  return [...DEFAULT_FISCAL_YEAR_OPTIONS];
};
