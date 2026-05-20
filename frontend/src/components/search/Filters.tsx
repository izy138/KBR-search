import { type ReactNode, useCallback, useMemo } from "react";
import {
  normalizeStateFacetKey,
  useCascadingFilterAvailability,
} from "../../hooks/useCascadingFilterAvailability";
import { useFilterDraft } from "../../hooks/useFilterDraft";
import type { FilterValues } from "../../types/filters";
import { normalizeFiltersOnApply } from "../../types/filters";
import { buildCascadingSelectOptions } from "../../utils/cascadingFilterOptions";
import {
  formatAllCapsLabel,
  formatDropdownLabel,
  resolveFiscalYearChoices,
} from "../../utils/filterLabels";
import type { FilterSelectOption } from "./FilterSelect";
import FilterField from "./FilterField";
import FilterSelect from "./FilterSelect";
import FiscalYearRangeSlider from "./FiscalYearRangeSlider";
import { cn } from "../../utils/cn";
import type { HelpTooltipContent } from "../../utils/helpContent";
import SearchBar from "./SearchBar";

export type FilterFieldHelpKey = "pi" | "ic" | "org" | "activity" | "fy";
export type FilterFieldHelp = Partial<Record<FilterFieldHelpKey, HelpTooltipContent>>;

const FILTER_FIELD_WIDTH = {
  pi: "w-[260px] max-[1100px]:flex-1 max-[1100px]:min-w-[140px]",
  ic: "w-[260px] max-[1100px]:flex-1 max-[1100px]:min-w-[130px]",
  org: "w-[260px] max-[1100px]:flex-1 max-[1100px]:min-w-[130px]",
  activity: "w-[145px] max-[1100px]:min-w-[110px]",
  state: "w-[145px] max-[1100px]:min-w-[100px]",
  fiscalYear: "w-[min(100%,220px)] shrink-0",
} as const;

export type { FilterValues } from "../../types/filters";

export type FilterCatalog = {
  icNames: string[];
  orgNames: string[];
  activityCodes: string[];
  states: string[];
  fiscalYearOptions?: number[];
};

type SelectFieldKey = "ic" | "org" | "activity" | "state";

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
    key: "org",
    label: "Organization",
    width: FILTER_FIELD_WIDTH.org,
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
  showAdvancedToggle?: boolean;
  semanticMode?: boolean;
  onSemanticModeChange?: (enabled: boolean) => void;
  showSemanticToggle?: boolean;
  onUpdateDashboard?: (query: string) => void;
  searchSubmitOnClear?: boolean;
  fieldHelp?: FilterFieldHelp;
  searchSlot?: ReactNode;
  /** Optional help control shown at the top-right of the filter panel. */
  helpTooltip?: ReactNode;
  /** Dashboard: drives activity-code preview in the funding pie chart area. */
  onActivityCodeHover?: (code: string | null) => void;
};

function Filters({
  applied,
  catalog,
  onApply,
  onClear,
  searchQuery,
  onSearch,
  showAdvancedToggle = true,
  semanticMode = false,
  onSemanticModeChange,
  showSemanticToggle = false,
  onUpdateDashboard,
  searchSubmitOnClear = true,
  fieldHelp,
  searchSlot,
  helpTooltip,
  onActivityCodeHover,
}: FiltersProps) {
  const { draft, patch, resetDraft } = useFilterDraft(applied);
  const cascadingAvailability = useCascadingFilterAvailability(draft);

  const fyChoices = useMemo(
    () => resolveFiscalYearChoices(catalog.fiscalYearOptions),
    [catalog.fiscalYearOptions],
  );

  const selectOptionsByKey = useMemo((): Record<SelectFieldKey, FilterSelectOption[]> => ({
    ic: buildCascadingSelectOptions(
      catalog.icNames,
      cascadingAvailability?.ic ?? null,
      draft.ic,
      formatDropdownLabel,
      false,
    ),
    org: buildCascadingSelectOptions(
      catalog.orgNames,
      cascadingAvailability?.org ?? null,
      draft.org,
      formatDropdownLabel,
    ),
    activity: buildCascadingSelectOptions(
      catalog.activityCodes,
      cascadingAvailability?.activity ?? null,
      draft.activity,
      formatAllCapsLabel,
    ),
    state: buildCascadingSelectOptions(
      catalog.states,
      cascadingAvailability?.state ?? null,
      draft.state,
      formatAllCapsLabel,
      true,
      normalizeStateFacetKey,
    ),
  }), [
    catalog.icNames,
    catalog.orgNames,
    catalog.activityCodes,
    catalog.states,
    cascadingAvailability,
    draft.ic,
    draft.org,
    draft.activity,
    draft.state,
  ]);

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
    <section className="relative -mt-1 flex flex-col items-stretch gap-[0.4rem] overflow-x-auto rounded-lg border border-border bg-surface px-3 pt-2.5 pb-3 min-[1101px]:overflow-x-visible">
      {helpTooltip ? (
        <div className="absolute top-2.5 right-3 z-10">{helpTooltip}</div>
      ) : null}
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
            help={
              field.key === "ic"
                ? fieldHelp?.ic
                : field.key === "org"
                  ? fieldHelp?.org
                  : field.key === "activity"
                    ? fieldHelp?.activity
                    : undefined
            }
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
              onOptionPointerEnter={
                field.key === "activity" && onActivityCodeHover
                  ? (opt) => onActivityCodeHover(opt.value)
                  : undefined
              }
              onOptionPointerLeave={
                field.key === "activity" && onActivityCodeHover
                  ? () => onActivityCodeHover(null)
                  : undefined
              }
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
