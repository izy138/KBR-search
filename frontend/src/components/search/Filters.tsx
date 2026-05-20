import { type ReactNode, useCallback, useMemo } from "react";
import { useFilterDraft } from "../../hooks/useFilterDraft";
import type { FilterValues } from "../../types/filters";
import { normalizeFiltersOnApply } from "../../types/filters";
import {
  formatAllCapsLabel,
  formatDropdownLabel,
  resolveFiscalYearChoices,
} from "../../utils/filterLabels";
import FilterField from "./FilterField";
import FilterSelect from "./FilterSelect";
import FiscalYearRangeSlider from "./FiscalYearRangeSlider";
import type { AdvancedSearchQuery } from "../../types/advancedSearch";
import { cn } from "../../utils/cn";
import type { HelpTooltipContent } from "../../utils/helpContent";
import SearchBar from "./SearchBar";

export type FilterFieldHelpKey = "pi" | "ic" | "activity" | "fy";
export type FilterFieldHelp = Partial<Record<FilterFieldHelpKey, HelpTooltipContent>>;

const FILTER_FIELD_WIDTH = {
  pi: "w-[280px] max-[1100px]:flex-1 max-[1100px]:min-w-[140px]",
  ic: "w-[280px] max-[1100px]:flex-1 max-[1100px]:min-w-[130px]",
  activity: "w-[165px] max-[1100px]:min-w-[110px]",
  state: "w-[165px] max-[1100px]:min-w-[100px]",
  fiscalYear: "w-[min(100%,220px)] shrink-0",
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
  semanticMode?: boolean;
  onSemanticModeChange?: (enabled: boolean) => void;
  showSemanticToggle?: boolean;
  onUpdateDashboard?: (query: string) => void;
  searchSubmitOnClear?: boolean;
  fieldHelp?: FilterFieldHelp;
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
  semanticMode = false,
  onSemanticModeChange,
  showSemanticToggle = false,
  onUpdateDashboard,
  searchSubmitOnClear = true,
  fieldHelp,
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
        semanticMode={semanticMode}
        onSemanticModeChange={onSemanticModeChange}
        showSemanticToggle={showSemanticToggle}
        onUpdateDashboard={onUpdateDashboard}
        initialQuery={searchQuery ?? ""}
        submitOnClear={searchSubmitOnClear}
      />
    ) : null);

  return (
    <section className="-mt-1 flex flex-col items-stretch gap-[0.4rem] overflow-x-auto rounded-lg border border-border bg-surface px-3 pt-2.5 pb-3 min-[1101px]:overflow-x-visible">
      {searchContent ? (
        <div
          className={cn(
            "min-w-0 w-full mx-auto pt-0.5 pb-1",
            showSemanticToggle ? "max-w-[860px]" : "max-w-[720px]",
          )}
        >
          {searchContent}
        </div>
      ) : null}

      <div className="mx-auto flex min-w-0 w-full max-w-full flex-wrap items-end justify-center gap-5">
        <FilterField
          label="Principal Investigator"
          help={fieldHelp?.pi}
          className={FILTER_FIELD_WIDTH.pi}
        >
          <input
            className="box-border w-full min-h-[2.5rem] rounded-sm border-2 border-accent-text/65 bg-bg px-[0.7rem] py-[0.48rem] font-sans text-[14px] leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-accent-text/90 focus:border-accent placeholder:text-text-muted"
            type="text"
            placeholder="Type PI name"
            value={draft.pi}
            onChange={(e) => patch({ pi: e.target.value })}
            onBlur={handleApply}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
          />
        </FilterField>

        {SELECT_FIELDS.map((field) => (
          <FilterField
            key={field.key}
            label={field.label}
            help={fieldHelp?.[field.key]}
            className={field.width}
          >
            <FilterSelect
              value={draft[field.key]}
              onChange={(value) => {
                const next = { ...draft, [field.key]: value };
                patch({ [field.key]: value });
                onApply(normalizeFiltersOnApply(next, fyChoices));
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

        <FilterField
          label="Fiscal Year"
          help={fieldHelp?.fy}
          className={FILTER_FIELD_WIDTH.fiscalYear}
        >
          <FiscalYearRangeSlider
            choices={fyChoices}
            fyMin={draft.fyMin}
            fyMax={draft.fyMax}
            onChange={(fyMin, fyMax) => patch({ fyMin, fyMax })}
            onCommit={(fyMin, fyMax) => {
              onApply(
                normalizeFiltersOnApply({ ...draft, fyMin, fyMax }, fyChoices),
              );
            }}
          />
        </FilterField>

        <div className="shrink-0">
          <button
            type="button"
            className="box-border min-h-[2rem] min-w-[4rem] cursor-pointer whitespace-nowrap rounded-sm border border-red-200/90 bg-red-50 px-4 font-sans text-[13px] font-medium text-red-700 transition-all duration-150 hover:border-red-300 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/45 dark:text-red-300 dark:hover:border-red-800/70 dark:hover:bg-red-950/70"
            onClick={handleClear}
          >
            Clear All
          </button>
        </div>
      </div>
    </section>
  );
}

export default Filters;
