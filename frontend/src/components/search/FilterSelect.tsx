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
        className={cn(
          "box-border w-full min-h-[2.5rem] rounded-sm border-2 border-accent-text/60 bg-bg px-[0.7rem] py-[0.48rem] font-sans text-[14px] leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-accent-text/90 focus:border-accent relative flex cursor-pointer appearance-none pr-8 text-left",
          truncateSelectedLabel && "min-w-0 overflow-hidden",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        title={selectedLabel}
        onClick={() => {
          setOpen((o) => !o);
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
