import type { FilterValues } from "../../types/filters";
import type { FilterBreadcrumbKey } from "../../utils/filterBreadcrumbOrder";
import {
  buildFilterBreadcrumbSegments,
  getActiveFilterBreadcrumbKeys,
} from "../../utils/filterBreadcrumbOrder";
import { cn } from "../../utils/cn";

type FilterBreadcrumbProps = {
  filters: FilterValues;
  order: FilterBreadcrumbKey[];
  onSegmentClick: (segmentIndex: number) => void;
};

function HomeIcon(): JSX.Element {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M2.5 7.5 8 2.5l5.5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.5 6.75V13h3.25V10h2.5v3h3.25V6.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FilterBreadcrumb({
  filters,
  order,
  onSegmentClick,
}: FilterBreadcrumbProps): JSX.Element {
  const activeKeys = getActiveFilterBreadcrumbKeys(filters, order);
  const segments = buildFilterBreadcrumbSegments(filters, order);
  const hasSegments = segments.length > 0;

  return (
    <nav
      aria-label="Filter selection path"
      className="min-h-[1.2rem] shrink-0 min-w-0 pb-0 pt-0"
      aria-hidden={hasSegments ? undefined : true}
    >
      {hasSegments ? (
        <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-sans text-sm font-bold leading-snug">
          <li className="flex min-w-0 max-w-full items-center gap-1.5">
            <button
              type="button"
              className={cn(
                "inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-sans text-sm font-bold text-accent-text underline-offset-2",
                "hover:text-accent hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
              )}
              onClick={() => onSegmentClick(-1)}
            >
              <HomeIcon />
              <span>Home</span>
            </button>
          </li>
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <li
                key={activeKeys[index] ?? `${segment}-${index}`}
                className="flex min-w-0 max-w-full items-center gap-1.5"
              >
                <span className="shrink-0 text-text-muted" aria-hidden="true">
                  &gt;
                </span>
                {isLast ? (
                  <span className="min-w-0 truncate text-text-primary">{segment}</span>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 max-w-full cursor-pointer truncate border-none bg-transparent p-0 font-sans text-sm font-bold text-accent-text underline-offset-2",
                      "hover:text-accent hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                    )}
                    onClick={() => onSegmentClick(index)}
                  >
                    {segment}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </nav>
  );
}
