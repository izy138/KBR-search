import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../utils/cn";

type HelpTooltipProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export default function HelpTooltip({ label, children, className }: HelpTooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", className)}
    >
      <button
        type="button"
        className="inline-flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[0.72rem] font-semibold leading-none text-text-muted transition-[color,border-color,background] duration-150 hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((prev) => !prev)}
      >
        ?
      </button>
      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(18.5rem,calc(100vw-2rem))] rounded-md border border-border bg-surface px-3 py-2.5 text-left text-[0.8rem] leading-[1.45] text-text-secondary shadow-md"
        >
          <p className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-text-muted">
            {label}
          </p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
