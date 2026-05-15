import {
  type CSSProperties,
  type FC,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import ReactSlider from 'react-slider'

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

/** Row-major grid move: index 0 is placeholder; indices 1.. are data in reading order. */
const moveHighlightInOptionGrid = (
  index: number,
  key: "ArrowDown" | "ArrowUp" | "ArrowLeft" | "ArrowRight",
  length: number,
  cols: number,
): number => {
  if (cols < 2 || length <= 1) return index;
  const dataCount = length - 1;
  if (dataCount <= 0) return index;

  if (index === 0) {
    if (key === "ArrowDown" || key === "ArrowRight") return 1;
    return 0;
  }

  const rel = index - 1;
  const col = rel % cols;

  if (key === "ArrowRight") {
    if (col < cols - 1 && rel + 1 < dataCount) return index + 1;
    return index;
  }
  if (key === "ArrowLeft") {
    if (col > 0) return index - 1;
    return 0;
  }
  if (key === "ArrowDown") {
    const belowRel = rel + cols;
    if (belowRel < dataCount) return 1 + belowRel;
    return index;
  }
  if (key === "ArrowUp") {
    if (rel < cols) return 0;
    return 1 + (rel - cols);
  }
  return index;
};

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
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [highlightIndex, setHighlightIndex] = useState(0);

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
    const idx = Math.max(0, flatOptions.findIndex((o) => o.value === value));
    setHighlightIndex(idx);
    updatePosition();
  }, [open, value, flatOptions, updatePosition]);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const gridKeys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"] as const;
      if (cols >= 2 && (gridKeys as readonly string[]).includes(e.key)) {
        e.preventDefault();
        setHighlightIndex((i) =>
          moveHighlightInOptionGrid(i, e.key as (typeof gridKeys)[number], flatOptions.length, cols),
        );
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(flatOptions.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setHighlightIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setHighlightIndex(flatOptions.length - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const opt = flatOptions[highlightIndex];
        if (opt) onChange(opt.value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatOptions, highlightIndex, onChange, cols]);

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlightIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, highlightIndex]);

  const maxPanelHeight = Math.min(
    window.innerHeight * 0.5,
    Math.max(120, window.innerHeight - coords.top - 12),
  );

  const panelClassName = cols >= 2 ? "filter-select-panel filter-select-panel--grid" : "filter-select-panel";

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
          ref={listRef}
          className={panelClassName}
          role="listbox"
          style={panelListStyle}
        >
          {flatOptions.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === highlightIndex;
            const spanFullRow = cols >= 2 && index === 0;
            const optionClass = [
              "filter-select-option",
              spanFullRow ? "filter-select-option--grid-span" : "",
              isActive ? "filter-select-option--active" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={opt.value === "" ? "__all__" : opt.value}
                type="button"
                role="option"
                data-option-index={index}
                aria-selected={isSelected}
                className={optionClass}
                onMouseEnter={() => setHighlightIndex(index)}
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
    <div ref={rootRef} className="filter-select-root">
      <button
        ref={triggerRef}
        type="button"
        className="sidebar-select filter-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        title={selectedLabel}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <span className="filter-select-trigger-label">{selectedLabel}</span>
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
    <section className="app-sidebar">
      {searchSlot ? (
        <div className="filters-search-slot">
          <div className="filters-search-inner">{searchSlot}</div>
        </div>
      ) : null}

      <div className="sidebar-section">
        <div className="sidebar-label">Principal Investigator</div>
        <input
          className="sidebar-text-input"
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
      </div>

      <div className="sidebar-section sidebar-section--ic">
        <div className="sidebar-label">NIH Institute / Center</div>
        <FilterSelect
          value={selectedIC}
          onChange={onICChange}
          options={icSelectOptions}
          placeholder="All Institutes"
          menuMinWidthPx={300}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">Activity Code</div>
        <FilterSelect
          value={selectedActivity}
          onChange={onActivityChange}
          options={activitySelectOptions}
          placeholder="All Codes"
          listColumns={3}
          menuMinWidthPx={260}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">State</div>
        <FilterSelect
          value={selectedState}
          onChange={onStateChange}
          options={stateSelectOptions}
          placeholder="All States"
          listColumns={3}
          menuMinWidthPx={260}
        />
      </div>

      <div className="sidebar-section sidebar-section--fy">
        <div className="sidebar-label">Fiscal Year</div>
        <div className="sidebar-range-row sidebar-range-row--fiscal">
          <FilterSelect
            ariaLabel="Fiscal year from"
            value={fyMin}
            onChange={onFyMinChange}
            options={fySelectOptions}
            placeholder={FY_RANGE_PLACEHOLDER}
          />
          <FilterSelect
            ariaLabel="Fiscal year to"
            value={fyMax}
            onChange={onFyMaxChange}
            options={fySelectOptions}
            placeholder={FY_RANGE_PLACEHOLDER}
          />
        </div>
      </div>

      <div className="filters-actions">
        <button type="button" className="btn-apply" onClick={handleApply}>
          Apply Filters
        </button>

        {hasFilters && (
          <button type="button" className="btn-clear" onClick={onClear}>
            Clear All
          </button>
        )}
      </div>
    </section>
  );
}

export default Filters;