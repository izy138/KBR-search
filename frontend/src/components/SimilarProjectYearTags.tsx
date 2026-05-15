import { useEffect, useId, useRef, useState } from "react";
import type { ProjectYearVariant } from "../api";

type SimilarProjectYearTagsProps = {
  variants: ProjectYearVariant[];
  onSelect: (variant: ProjectYearVariant) => void;
};

const VISIBLE_RECENT_COUNT = 2;

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
    return <div className="project-details-similar-year-tags" aria-hidden="true" />;
  }

  const handleSelect = (variant: ProjectYearVariant): void => {
    setMenuOpen(false);
    onSelect(variant);
  };

  return (
    <div
      ref={rootRef}
      className="project-details-similar-year-tags"
      aria-label="Fiscal years for this similar project"
    >
      {visibleRecent.map((variant) => (
        <button
          key={`${variant.fy ?? "na"}-${variant.project_id}`}
          type="button"
          className="project-details-similar-year-tag"
          onClick={() => handleSelect(variant)}
        >
          {formatFyLabel(variant.fy)}
        </button>
      ))}
      {priorCount > 0 ? (
        <div className="project-details-similar-year-more-wrap">
          <button
            type="button"
            className="project-details-similar-year-more"
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
              className="project-details-similar-year-menu"
              role="menu"
              aria-label="Earlier fiscal years"
            >
              {prior.map((variant) => (
                <li key={`${variant.fy ?? "na"}-${variant.project_id}`} role="none">
                  <button
                    type="button"
                    className="project-details-similar-year-menu-item"
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
