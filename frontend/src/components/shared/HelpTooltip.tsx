import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

const HIDE_DELAY_MS = 120;
const VIEWPORT_PAD = 12;
const PANEL_GAP = 6;
const PANEL_MAX_WIDTH_PX = 296;

type HelpTooltipPlacement = "after" | "before";

type HelpTooltipProps = {
  label: string;
  children: ReactNode;
  className?: string;
  placement?: HelpTooltipPlacement;
};

type PanelCoords = {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
};

function clampPanelPosition(
  anchor: DOMRect,
  panelWidth: number,
  panelHeight: number,
  placement: HelpTooltipPlacement,
): PanelCoords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = VIEWPORT_PAD;
  const maxWidth = Math.min(PANEL_MAX_WIDTH_PX, vw - pad * 2);
  const maxHeight = vh - pad * 2;
  const width = Math.min(panelWidth, maxWidth);
  const height = Math.min(panelHeight, maxHeight);

  let left =
    placement === "after"
      ? anchor.right + PANEL_GAP
      : anchor.left - PANEL_GAP - width;

  if (placement === "after" && left + width > vw - pad) {
    left = anchor.left - PANEL_GAP - width;
  } else if (placement === "before" && left < pad) {
    left = anchor.right + PANEL_GAP;
  }

  left = Math.max(pad, Math.min(left, vw - pad - width));

  let top = anchor.top + (anchor.height - height) / 2;
  top = Math.max(pad, Math.min(top, vh - pad - height));

  return { top, left, maxWidth, maxHeight };
}

export default function HelpTooltip({
  label,
  children,
  className,
  placement = "after",
}: HelpTooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [panelCoords, setPanelCoords] = useState<PanelCoords | null>(null);

  const show = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelCoords(null);
      return;
    }

    const anchorEl = rootRef.current?.querySelector("button");
    const panelEl = panelRef.current;
    if (!anchorEl || !panelEl) return;

    const updatePosition = () => {
      const anchor = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = VIEWPORT_PAD;
      const maxWidth = Math.min(PANEL_MAX_WIDTH_PX, vw - pad * 2);
      const maxHeight = vh - pad * 2;

      panelEl.style.width = `${maxWidth}px`;
      panelEl.style.maxHeight = `${maxHeight}px`;

      const { width: panelWidth, height: panelHeight } = panelEl.getBoundingClientRect();
      setPanelCoords(clampPanelPosition(anchor, panelWidth, panelHeight, placement));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, placement, label, children]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const panel =
    open ? (
      <div
        ref={panelRef}
        id={tooltipId}
        role="tooltip"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        style={{
          position: "fixed",
          top: panelCoords?.top ?? 0,
          left: panelCoords?.left ?? 0,
          maxWidth: panelCoords?.maxWidth ?? PANEL_MAX_WIDTH_PX,
          maxHeight: panelCoords?.maxHeight,
          visibility: panelCoords ? "visible" : "hidden",
        }}
        className="z-[100] overflow-y-auto rounded-md border border-border bg-surface px-3 py-2.5 text-left text-[0.8rem] leading-[1.45] text-text-secondary shadow-md"
      >
        <p className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-text-muted">
          {label}
        </p>
        {children}
      </div>
    ) : null;

  return (
    <>
      <div
        ref={rootRef}
        className={cn("relative inline-flex", className)}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <button
          type="button"
          className="inline-flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[0.72rem] font-semibold leading-none text-text-muted transition-[color,border-color,background] duration-150 hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          aria-label={label}
          aria-expanded={open}
          aria-controls={tooltipId}
          onFocus={show}
          onBlur={scheduleHide}
        >
          ?
        </button>
      </div>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
