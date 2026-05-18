import { type ReactNode, useCallback, useMemo } from "react";
import { useFilterDraft } from "../../hooks/useFilterDraft";
import type { FilterValues } from "../../types/filters";
import { hasActiveFilters, normalizeFiltersOnApply } from "../../types/filters";
import {
  FY_RANGE_PLACEHOLDER,
  formatAllCapsLabel,
  formatDropdownLabel,
  resolveFiscalYearChoices,
} from "../../utils/filterLabels";
import FilterField from "./FilterField";
import FilterSelect from "./FilterSelect";
import type { AdvancedSearchQuery } from "../../types/advancedSearch";
import SearchBar from "./SearchBar";

const FILTER_FIELD_WIDTH = {
  pi: "w-[280px] max-[1100px]:flex-1 max-[1100px]:min-w-[140px]",
  ic: "w-[280px] max-[1100px]:flex-1 max-[1100px]:min-w-[130px]",
  activity: "w-[165px] max-[1100px]:min-w-[110px]",
  state: "w-[165px] max-[1100px]:min-w-[100px]",
  fiscalYear: "w-[195px] shrink-0",
} as const;

export type { FilterValues } from "../../types/filters";

export type FilterCatalog = {
  icNames: string[];
  activityCodes: string[];
  states: string[];
  fiscalYearOptions?: number[];
};

type SelectFieldKey = "ic" | "activity" | "state";

type SelectFieldConfig = {
  key: SelectFieldKey;
  label: string;
  width: string;
  placeholder: string;
  ariaLabel?: string;
  menuMinWidthPx?: number;
  listColumns?: number;
  truncateSelectedLabel?: boolean;
};

const SELECT_FIELDS: readonly SelectFieldConfig[] = [
  {
    key: "ic",
    label: "NIH Institute / Center",
    width: FILTER_FIELD_WIDTH.ic,
    placeholder: "All",
    menuMinWidthPx: 300,
    truncateSelectedLabel: true,
  },
  {
    key: "activity",
    label: "Activity Code",
    width: FILTER_FIELD_WIDTH.activity,
    placeholder: "All",
    listColumns: 3,
    menuMinWidthPx: 260,
  },
  {
    key: "state",
    label: "State",
    width: FILTER_FIELD_WIDTH.state,
    placeholder: "All",
    ariaLabel: "State",
    listColumns: 3,
    menuMinWidthPx: 260,
  },
];

type FiltersProps = {
  applied: FilterValues;
  catalog: FilterCatalog;
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
  onAdvancedSearch?: (query: AdvancedSearchQuery) => void;
  advancedSearch?: AdvancedSearchQuery | null;
  onExitAdvancedSearch?: () => void;
  showAdvancedToggle?: boolean;
  onUpdateDashboard?: (query: string) => void;
  searchSubmitOnClear?: boolean;
  /** When true, dropdown changes apply immediately (PI still uses Apply / Enter). */
  applyOnSelectChange?: boolean;
  /** Override built-in SearchBar when a custom search UI is required. */
  searchSlot?: ReactNode;
};

function Filters({
  applied,
  catalog,
  onApply,
  onClear,
  searchQuery,
  onSearch,
  onAdvancedSearch,
  advancedSearch,
  onExitAdvancedSearch,
  showAdvancedToggle = true,
  onUpdateDashboard,
  searchSubmitOnClear = true,
  applyOnSelectChange = false,
  searchSlot,
}: FiltersProps) {
  const { draft, patch, resetDraft } = useFilterDraft(applied);

  const fyChoices = useMemo(
    () => resolveFiscalYearChoices(catalog.fiscalYearOptions),
    [catalog.fiscalYearOptions],
  );

  const selectOptionsByKey = useMemo(
    (): Record<SelectFieldKey, { value: string; label: string }[]> => ({
      ic: catalog.icNames.map((ic) => ({ value: ic, label: formatDropdownLabel(ic) })),
      activity: [...catalog.activityCodes]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((code) => ({ value: code, label: formatAllCapsLabel(code) })),
      state: [...catalog.states]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((s) => ({ value: s, label: formatAllCapsLabel(s) })),
    }),
    [catalog.icNames, catalog.activityCodes, catalog.states],
  );

  const fySelectOptions = useMemo(
    () => fyChoices.map((y) => ({ value: String(y), label: String(y) })),
    [fyChoices],
  );

  const showClear = hasActiveFilters(draft);

  const handleApply = useCallback(() => {
    onApply(normalizeFiltersOnApply(draft, fyChoices));
  }, [draft, fyChoices, onApply]);

  const handleClear = useCallback(() => {
    resetDraft();
    onClear();
  }, [onClear, resetDraft]);

  const searchContent =
    searchSlot ??
    (onSearch != null ? (
      <SearchBar
        onSearch={onSearch}
        onAdvancedSearch={onAdvancedSearch}
        advancedSearch={advancedSearch}
        onExitAdvancedSearch={onExitAdvancedSearch}
        showAdvancedToggle={showAdvancedToggle}
        onUpdateDashboard={onUpdateDashboard}
        initialQuery={searchQuery ?? ""}
        submitOnClear={searchSubmitOnClear}
      />
    ) : null);

  return (
    <section className="-mt-1 flex flex-col items-stretch gap-[0.7rem] overflow-x-auto rounded-lg border border-border bg-surface px-3 pt-2.5 pb-3 min-[1101px]:overflow-x-visible">
      {searchContent ? <div className="min-w-0 w-full max-w-[720px] mx-auto">{searchContent}</div> : null}

      <div className="flex min-w-0 flex-wrap items-end gap-2 max-[1100px]:w-full">
        <FilterField label="Principal Investigator" className={FILTER_FIELD_WIDTH.pi}>
          <input
            className="box-border w-full min-h-[2.5rem] rounded-sm border border-border bg-bg px-[0.7rem] py-[0.48rem] font-sans text-[14px] leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-accent/40 focus:border-accent placeholder:text-text-muted"
            type="text"
            placeholder="Type PI name"
            value={draft.pi}
            onChange={(e) => patch({ pi: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
          />
        </FilterField>

        {SELECT_FIELDS.map((field) => (
          <FilterField key={field.key} label={field.label} className={field.width}>
            <FilterSelect
              value={draft[field.key]}
              onChange={(value) => {
                const next = { ...draft, [field.key]: value };
                patch({ [field.key]: value });
                if (applyOnSelectChange) {
                  onApply(next);
                }
              }}
              options={selectOptionsByKey[field.key]}
              placeholder={field.placeholder}
              ariaLabel={field.ariaLabel}
              menuMinWidthPx={field.menuMinWidthPx}
              listColumns={field.listColumns}
              truncateSelectedLabel={field.truncateSelectedLabel}
            />
          </FilterField>
        ))}

        <FilterField label="Fiscal Year" className={FILTER_FIELD_WIDTH.fiscalYear}>
          <div className="flex gap-2">
            <FilterSelect
              ariaLabel="Fiscal year from"
              value={draft.fyMin}
              onChange={(fyMin) => {
                const next = { ...draft, fyMin };
                patch({ fyMin });
                if (applyOnSelectChange) {
                  onApply(next);
                }
              }}
              options={fySelectOptions}
              placeholder={FY_RANGE_PLACEHOLDER}
            />
            <FilterSelect
              ariaLabel="Fiscal year to"
              value={draft.fyMax}
              onChange={(fyMax) => {
                const next = { ...draft, fyMax };
                patch({ fyMax });
                if (applyOnSelectChange) {
                  onApply(next);
                }
              }}
              options={fySelectOptions}
              placeholder={FY_RANGE_PLACEHOLDER}
            />
          </div>
        </FilterField>

        <div className="flex shrink-0 flex-col items-stretch gap-1 pb-px">
          {showClear ? (
            <button type="button" className="min-h-[1.5rem] cursor-pointer whitespace-nowrap rounded-sm border border-100% bg-bg px-[0.45rem] py-[0.08rem] font-sans text-[12px] text-text-secondary transition-all duration-150 hover:border-border-strong hover:bg-surface-hover hover:text-text-primary" onClick={handleClear}>
              Clear All
            </button>
          ) : null}
          <button type="button" className="min-h-[1.5rem] cursor-pointer whitespace-nowrap rounded-sm border-none bg-green px-[0.6rem] py-[0.34rem] font-sans text-[14px] font-medium text-white transition-colors duration-150 hover:brightness-110" onClick={handleApply}>
            Apply Filters
          </button>
        </div>
      </div>
    </section>
  );
}

export default Filters;
