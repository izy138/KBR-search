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
import { cn } from "../../utils/cn";

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  placeholder: string;
  ariaLabel?: string;
  menuMinWidthPx?: number;
  listColumns?: number;
  truncateSelectedLabel?: boolean;
  /** When false, the empty placeholder row is omitted (toolbar selects). Default true. */
  includeEmptyOption?: boolean;
  /** Smaller trigger for compact toolbars. */
  compact?: boolean;
  disabled?: boolean;
  onOptionPointerEnter?: (option: FilterSelectOption) => void;
  onOptionPointerLeave?: () => void;
};

const FilterSelect: FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  menuMinWidthPx,
  listColumns,
  truncateSelectedLabel = false,
  includeEmptyOption = true,
  compact = false,
  disabled = false,
  onOptionPointerEnter,
  onOptionPointerLeave,
}) => {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelOuterRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const closeDropdown = useCallback(() => {
    onOptionPointerLeave?.();
    setOpen(false);
  }, [onOptionPointerLeave]);

  const flatOptions = useMemo((): readonly FilterSelectOption[] => {
    if (includeEmptyOption) {
      return [{ value: "", label: placeholder }, ...options];
    }
    return options;
  }, [includeEmptyOption, placeholder, options]);

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
      closeDropdown();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!disabled) return;
    closeDropdown();
  }, [disabled, closeDropdown]);

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
            const isDisabled = Boolean(opt.disabled);
            return (
              <button
                key={opt.value === "" ? "__all__" : opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                disabled={isDisabled}
                className={cn(
                  "filter-select-option",
                  spanFullRow && "filter-select-option--grid-span",
                  isDisabled && "filter-select-option--disabled",
                )}
                title={opt.label}
                onMouseEnter={() => {
                  if (opt.value !== "" && !isDisabled) {
                    onOptionPointerEnter?.(opt);
                  }
                }}
                onMouseLeave={() => onOptionPointerLeave?.()}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(opt.value);
                  closeDropdown();
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
        className={cn(
          "box-border w-full rounded-sm border-2 border-border-input bg-bg font-sans leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-border-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 relative flex cursor-pointer appearance-none pr-8 text-left",
          compact
            ? "min-h-[2rem] px-[1.25rem] py-[0.5rem] text-[12px]"
            : "min-h-[2.5rem] px-[0.7rem] py-[0.48rem] text-[14px]",
          truncateSelectedLabel && "min-w-0 overflow-hidden",
        )}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        title={selectedLabel}
        onClick={() => {
          if (disabled) return;
          if (open) {
            closeDropdown();
          } else {
            setOpen(true);
          }
        }}
      >
        <span
          className={cn(
            "min-w-0 flex-1 text-left",
            truncateSelectedLabel ? "truncate" : "break-words [overflow-wrap:anywhere]",
          )}
        >
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

export default FilterSelect;
