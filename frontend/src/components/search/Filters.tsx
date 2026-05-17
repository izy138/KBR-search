import {
  type CSSProperties,
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

type FilterSelectOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  placeholder: string;
  ariaLabel?: string;
  /** When set, menu is at least this wide (px) so long labels stay readable. */
  menuMinWidthPx?: number;
  /** When >1, options (after placeholder) render in a row-major grid with this many columns. */
  listColumns?: number;
};

/** Shared field chrome for text inputs and custom select triggers. */
const filterControlClass =
  "box-border w-full min-h-[2.35rem] rounded-sm border border-border bg-bg px-[0.62rem] py-[0.42rem] font-sans text-[13px] leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-accent/40 focus:border-accent";

const FilterSelect: FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  menuMinWidthPx,
  listColumns,
}) => {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelOuterRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const flatOptions = useMemo(
    (): readonly FilterSelectOption[] => [{ value: "", label: placeholder }, ...options],
    [placeholder, options],
  );

  const selectedLabel =
    flatOptions.find((o) => o.value === value)?.label ?? placeholder;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const triggerW = r.width;
    const width =
      menuMinWidthPx != null && menuMinWidthPx > 0
        ? Math.max(triggerW, menuMinWidthPx)
        : triggerW;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setCoords({ top: r.bottom + 4, left, width });
  }, [menuMinWidthPx]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    const onReposition = () => {
      updatePosition();
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelOuterRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const cols = listColumns != null && listColumns > 1 ? Math.floor(listColumns) : 1;

  const maxPanelHeight = Math.min(
    window.innerHeight * 0.5,
    Math.max(120, window.innerHeight - coords.top - 12),
  );

  const panelListStyle: CSSProperties = {
    maxHeight: maxPanelHeight,
    ...(cols >= 2
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: "0.28rem 0.45rem",
          alignContent: "start",
        }
      : {}),
  };

  const panel =
    open &&
    createPortal(
      <div
        ref={panelOuterRef}
        className="filter-select-portal"
        style={{ top: coords.top, left: coords.left, width: coords.width }}
      >
        <div
          id={listboxId}
          className={cn("filter-select-panel", cols >= 2 && "filter-select-panel--grid")}
          role="listbox"
          style={panelListStyle}
        >
          {flatOptions.map((opt, index) => {
            const isSelected = opt.value === value;
            const spanFullRow = cols >= 2 && index === 0;
            return (
              <button
                key={opt.value === "" ? "__all__" : opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn("filter-select-option", spanFullRow && "filter-select-option--grid-span")}
                title={opt.label}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        className={cn(filterControlClass, "relative flex cursor-pointer appearance-none pr-8 text-left")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        title={selectedLabel}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <span className="min-w-0 flex-1 break-words text-left [overflow-wrap:anywhere]">
          {selectedLabel}
        </span>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M6 8L1 3h10z" />
        </svg>
      </button>
      {panel}
    </div>
  );
};

type FiltersProps = {
  /** Rendered at the top of the filter panel (e.g. search bar). */
  searchSlot?: React.ReactNode;
  icNames: string[];
  activityCodes: string[];
  states: string[];
  /** When set (e.g. from dashboard year aggregates), FY dropdowns use these values. */
  fiscalYearOptions?: number[];
  selectedPI: string;
  selectedIC: string;
  selectedActivity: string;
  selectedState: string;
  fyMin: string;
  fyMax: string;
  onPIChange: (value: string) => void;
  onICChange: (value: string) => void;
  onActivityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onFyMinChange: (value: string) => void;
  onFyMaxChange: (value: string) => void;
  onApply: (filters: {
    pi: string;
    ic: string;
    activity: string;
    state: string;
    fyMin: string;
    fyMax: string;
  }) => void;
  onClear: () => void;
};

const formatDropdownLabel = (value: string): string => {
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

const formatAllCapsLabel = (value: string): string => value.trim().toUpperCase();

/** Default FY choices when parent does not pass `fiscalYearOptions` (e.g. search view). */
const DEFAULT_FISCAL_YEAR_OPTIONS: readonly number[] = [2020, 2021, 2022, 2023, 2024, 2025];

/** Empty FY selection: UI shows this; Apply maps to catalog min/max years. */
const FY_RANGE_PLACEHOLDER = "-";

type FilterFieldProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

const FilterField: FC<FilterFieldProps> = ({ label, children, className }) => (
  <div className={cn("flex min-w-0 flex-col", className)}>
    {label ? (
      <div className="mb-[0.38rem] whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {label}
      </div>
    ) : null}
    {children}
  </div>
);

function Filters({
  searchSlot,
  icNames,
  activityCodes,
  states,
  fiscalYearOptions,
  selectedPI,
  selectedIC,
  selectedActivity,
  selectedState,
  fyMin,
  fyMax,
  onPIChange,
  onICChange,
  onActivityChange,
  onStateChange,
  onFyMinChange,
  onFyMaxChange,
  onApply,
  onClear,
}: FiltersProps) {
  const fyChoices = useMemo(() => {
    if (fiscalYearOptions && fiscalYearOptions.length > 0) {
      return [...new Set(fiscalYearOptions)].sort((a, b) => a - b);
    }
    return [...DEFAULT_FISCAL_YEAR_OPTIONS];
  }, [fiscalYearOptions]);

  const icSelectOptions = useMemo(
    () => icNames.map((ic) => ({ value: ic, label: formatDropdownLabel(ic) })),
    [icNames],
  );

  const activitySelectOptions = useMemo(
    () =>
      [...activityCodes]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((code) => ({ value: code, label: formatAllCapsLabel(code) })),
    [activityCodes],
  );

  const stateSelectOptions = useMemo(
    () =>
      [...states]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((s) => ({ value: s, label: formatAllCapsLabel(s) })),
    [states],
  );

  const fySelectOptions = useMemo(
    () => fyChoices.map((y) => ({ value: String(y), label: String(y) })),
    [fyChoices],
  );

  const hasFilters = selectedPI || selectedIC || selectedActivity || selectedState || fyMin || fyMax;

  const handleApply = useCallback(() => {
    let nextFyMin = fyMin.trim();
    let nextFyMax = fyMax.trim();

    if (!nextFyMin && !nextFyMax && fyChoices.length > 0) {
      nextFyMin = String(fyChoices[0]);
      nextFyMax = String(fyChoices[fyChoices.length - 1]);
    }

    const nMin = nextFyMin ? Number.parseInt(nextFyMin, 10) : Number.NaN;
    const nMax = nextFyMax ? Number.parseInt(nextFyMax, 10) : Number.NaN;
    if (Number.isFinite(nMin) && Number.isFinite(nMax) && nMin > nMax) {
      nextFyMin = String(nMax);
      nextFyMax = String(nMin);
    }
    onApply({
      pi: selectedPI,
      ic: selectedIC,
      activity: selectedActivity,
      state: selectedState,
      fyMin: nextFyMin,
      fyMax: nextFyMax,
    });
  }, [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax, fyChoices, onApply]);

  return (
    <section className="-mt-1 flex items-end gap-[0.7rem] overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2.5 max-[1100px]:flex-wrap max-[1100px]:overflow-x-visible">
      {searchSlot ? (
        <div className="min-w-[220px] flex-[1_1_280px] max-[1100px]:min-w-0 max-[1100px]:basis-full">
          {searchSlot}
        </div>
      ) : null}

      <div className="flex shrink-0 items-end gap-2 max-[1100px]:w-full max-[1100px]:flex-wrap">
        <FilterField label="Principal Investigator" className="w-[118px]">
          <input
            className={cn(filterControlClass, "placeholder:text-text-muted")}
            type="text"
            placeholder="Type PI name"
            value={selectedPI}
            onChange={(e) => onPIChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
          />
        </FilterField>

        <FilterField label="NIH Institute / Center" className="w-[132px]">
          <FilterSelect
            value={selectedIC}
            onChange={onICChange}
            options={icSelectOptions}
            placeholder="All Institutes"
            menuMinWidthPx={300}
          />
        </FilterField>

        <FilterField label="Activity Code" className="w-[108px]">
          <FilterSelect
            value={selectedActivity}
            onChange={onActivityChange}
            options={activitySelectOptions}
            placeholder="All Codes"
            listColumns={3}
            menuMinWidthPx={260}
          />
        </FilterField>

        {/* State / FY: no visible label (compact bar); placeholder + ariaLabel for screen readers. */}
        <FilterField className="w-[100px]">
          <FilterSelect
            ariaLabel="State"
            value={selectedState}
            onChange={onStateChange}
            options={stateSelectOptions}
            placeholder="All States"
            listColumns={3}
            menuMinWidthPx={260}
          />
        </FilterField>

        <FilterField className="w-[68px]">
          <FilterSelect
            ariaLabel="Fiscal year from"
            value={fyMin}
            onChange={onFyMinChange}
            options={fySelectOptions}
            placeholder={FY_RANGE_PLACEHOLDER}
          />
        </FilterField>

        <FilterField className="w-[68px]">
          <FilterSelect
            ariaLabel="Fiscal year to"
            value={fyMax}
            onChange={onFyMaxChange}
            options={fySelectOptions}
            placeholder={FY_RANGE_PLACEHOLDER}
          />
        </FilterField>

        <div className="flex shrink-0 items-center gap-1.5 pb-px">
          <button
            type="button"
            className="min-h-[2.35rem] cursor-pointer whitespace-nowrap rounded-sm border-none bg-accent px-[0.85rem] py-[0.42rem] font-sans text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
            onClick={handleApply}
          >
            Apply Filters
          </button>

          {hasFilters ? (
            <button
              type="button"
              className="min-h-[2.35rem] cursor-pointer whitespace-nowrap rounded-sm border border-border bg-transparent px-[0.65rem] py-[0.38rem] font-sans text-xs text-text-secondary transition-all duration-150 hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
              onClick={onClear}
            >
              Clear All
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default Filters;
