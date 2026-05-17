import { useEffect, useId, useRef, useState } from "react";
import type { ProjectYearVariant } from "../../api";
import { cn } from "../../utils/cn";
import FiscalYearTag from "./FiscalYearTag";

type SimilarProjectYearTagsProps = {
  variants: ProjectYearVariant[];
  onSelect: (variant: ProjectYearVariant) => void;
};

const VISIBLE_RECENT_COUNT = 2;

const moreBtn =
  "inline-flex items-center px-[0.45rem] py-[0.15rem] rounded-full border border-border-strong bg-surface text-text-secondary font-sans text-[0.72rem] font-semibold leading-[1.2] cursor-pointer hover:border-text-muted hover:text-text-primary hover:bg-surface-hover";

const moreBtnOpen =
  "border-text-muted text-text-primary bg-surface-hover";

const menuItem =
  "block w-full px-[0.55rem] py-[0.35rem] border-none rounded-[4px] bg-transparent text-green font-sans text-[0.72rem] font-semibold text-left cursor-pointer hover:bg-green-light";

function formatFyLabel(fy: number | undefined): string {
  return fy != null ? `FY ${fy}` : "Year";
}

export default function SimilarProjectYearTags({
  variants,
  onSelect,
}: SimilarProjectYearTagsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const visibleRecent =
    variants.length <= VISIBLE_RECENT_COUNT
      ? variants
      : variants.slice(-VISIBLE_RECENT_COUNT);
  const prior =
    variants.length > VISIBLE_RECENT_COUNT
      ? [...variants.slice(0, -VISIBLE_RECENT_COUNT)].reverse()
      : [];
  const priorCount = prior.length;

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (visibleRecent.length === 0) {
    return <div className="flex flex-wrap items-center gap-[0.3rem] min-w-0 flex-auto" aria-hidden="true" />;
  }

  const handleSelect = (variant: ProjectYearVariant): void => {
    setMenuOpen(false);
    onSelect(variant);
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center gap-[0.3rem] min-w-0 flex-auto"
      aria-label="Fiscal years for this similar project"
    >
      {visibleRecent.map((variant) => (
        <FiscalYearTag
          key={`${variant.fy ?? "na"}-${variant.project_id}`}
          compact
          onClick={() => handleSelect(variant)}
        >
          {formatFyLabel(variant.fy)}
        </FiscalYearTag>
      ))}
      {priorCount > 0 ? (
        <div className="relative">
          <button
            type="button"
            className={cn(moreBtn, menuOpen && moreBtnOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            aria-label={`${priorCount} earlier fiscal ${priorCount === 1 ? "year" : "years"}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            +{priorCount}
          </button>
          {menuOpen ? (
            <ul
              id={menuId}
              className="absolute top-[calc(100%+0.25rem)] left-0 z-20 min-w-[6.5rem] max-h-44 overflow-y-auto m-0 p-1 list-none rounded-sm border border-border-strong bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              role="menu"
              aria-label="Earlier fiscal years"
            >
              {prior.map((variant) => (
                <li key={`${variant.fy ?? "na"}-${variant.project_id}`} role="none">
                  <button
                    type="button"
                    className={menuItem}
                    role="menuitem"
                    onClick={() => handleSelect(variant)}
                  >
                    {formatFyLabel(variant.fy)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
