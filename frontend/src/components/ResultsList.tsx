import React, { useState, useCallback, useMemo } from "react";
import type { SearchResultRecord } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultsListProps = {
  results: SearchResultRecord[];
  loading?: boolean;
  onOpenDetails?: (item: SearchResultRecord) => void;
};

type SortDirection = "asc" | "desc" | "none";

type SortColumnKey =
  | "PI_NAMEs"
  | "ORG_NAME"
  | "IC_NAME"
  | "ACTIVITY"
  | "FY"
  | "PROJECT_START"
  | "TOTAL_COST";

interface SortState {
  column: SortColumnKey | null;
  direction: SortDirection;
}

interface ColumnDef {
  key: SortColumnKey;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  { key: "PI_NAMEs",      label: "Author"        },
  { key: "ORG_NAME",      label: "University"    },
  { key: "IC_NAME",       label: "Institution"   },
  { key: "ACTIVITY",      label: "Code"          },
  { key: "FY",            label: "FY"            },
  { key: "PROJECT_START", label: "Date"          },
  { key: "TOTAL_COST",    label: "Total Cost"    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCost(value: number | undefined): string {
  if (value == null || isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  // Accept ISO dates like "2024-09-01" or "09/01/2024"
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getSortValue(item: SearchResultRecord, column: SortColumnKey): string | number {
  const raw = item[column];
  if (raw == null) return "";
  if (column === "TOTAL_COST") {
    if (typeof raw === "number") return raw;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }
  if (typeof raw === "number") return raw;
  return String(raw).toLowerCase();
}

function cycleSortDirection(current: SortDirection): SortDirection {
  if (current === "none") return "asc";
  if (current === "asc") return "desc";
  return "none";
}

// ─── Sort Chevron Icon ────────────────────────────────────────────────────────

const ChevronIcon: React.FC<{ direction: SortDirection }> = ({ direction }) => {
  if (direction === "asc") {
    return (
      <svg
        className="sort-chevron sort-chevron--active sort-chevron--asc"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2 7L5 3L8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  if (direction === "desc") {
    return (
      <svg
        className="sort-chevron sort-chevron--active sort-chevron--desc"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2 3L5 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  // none — neutral double-chevron
  return (
    <svg
      className="sort-chevron sort-chevron--neutral"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 6.5L5 4L8 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M2 7.5L5 5L8 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4" />
    </svg>
  );
};

// ─── Sticky Sort Header ───────────────────────────────────────────────────────

interface SortHeaderProps {
  sort: SortState;
  onSort: (column: SortColumnKey) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({ sort, onSort }) => (
  <div className="results-table-header" role="row">
    <div className="results-table-header-grid">
      {COLUMNS.map((col) => {
        const isActive = sort.column === col.key && sort.direction !== "none";
        const currentDirection: SortDirection = sort.column === col.key ? sort.direction : "none";
        const ariaSort: React.AriaAttributes["aria-sort"] =
          sort.column === col.key
            ? sort.direction === "asc"
              ? "ascending"
              : sort.direction === "desc"
              ? "descending"
              : "none"
            : "none";

        return (
          <button
            key={col.key}
            className={`results-table-th${isActive ? " results-table-th--active" : ""}${currentDirection === "asc" ? " results-table-th--active-asc" : ""}${currentDirection === "desc" ? " results-table-th--active-desc" : ""}`}
            role="columnheader"
            aria-sort={ariaSort}
            onClick={() => onSort(col.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSort(col.key);
              }
            }}
          >
            <span className="results-table-th-label">{col.label}</span>
            <ChevronIcon direction={currentDirection} />
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="result-row result-row--skeleton" aria-hidden="true">
    <div className="result-row-cols">
      {COLUMNS.map((col) => (
        <div key={col.key} className="result-row-cell">
          <div className="skeleton-line" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
    <div className="result-row-bottom">
      <div className="skeleton-line" style={{ width: "55%" }} />
      <div className="skeleton-line" style={{ width: "12%", marginLeft: "auto" }} />
    </div>
  </div>
);

// ─── Result Row ───────────────────────────────────────────────────────────────

interface ResultRowProps {
  item: SearchResultRecord;
  onOpenDetails?: (item: SearchResultRecord) => void;
}

const ResultRow: React.FC<ResultRowProps> = ({ item, onOpenDetails }) => {
  const title =
    item.PROJECT_TITLE ?? item.title ?? item.project_title ?? "Untitled Project";
  const totalCost = item.TOTAL_COST as number | undefined;

  const cellValues: Record<SortColumnKey, string> = {
    PI_NAMEs:      item.PI_NAMEs      ?? "—",
    ORG_NAME:      item.ORG_NAME      ?? "—",
    IC_NAME:       item.IC_NAME       ?? "—",
    ACTIVITY:      item.ACTIVITY      ?? "—",
    FY:            item.FY != null    ? String(item.FY) : "—",
    PROJECT_START: formatDate(item.PROJECT_START),
    TOTAL_COST:    formatCost(totalCost),
  };

  const handleActivate = useCallback(() => {
    onOpenDetails?.(item);
  }, [item, onOpenDetails]);

  return (
    <div
      className="result-row"
      role="row"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      aria-label={`Project: ${title}`}
    >
      {/* First line: title */}
      <div className="result-row-bottom" role="presentation">
        <h3 className="result-title">{title}</h3>
      </div>

      {/* Second line: column-aligned metadata strip */}
      <div className="result-row-cols" role="presentation">
        {COLUMNS.map((col) => (
          <div key={col.key} className="result-row-cell" role="cell">
            <span
              className={`result-row-cell-value${
                col.key === "ACTIVITY" ? " result-row-cell-value--activity" : ""
              }${col.key === "FY" ? " result-row-cell-value--fy" : ""}`}
            >
              {cellValues[col.key]}
            </span>
          </div>
        ))}
      </div>
      
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ResultsList: React.FC<ResultsListProps> = ({ results, loading, onOpenDetails }) => {
  const [sort, setSort] = useState<SortState>({ column: null, direction: "none" });

  const handleSort = useCallback((column: SortColumnKey) => {
    setSort((prev) => {
      if (prev.column !== column) {
        // New column: always start at asc
        return { column, direction: "asc" };
      }
      const next = cycleSortDirection(prev.direction);
      return { column: next === "none" ? null : column, direction: next };
    });
  }, []);

  const sortedResults = useMemo<SearchResultRecord[]>(() => {
    if (sort.column === null || sort.direction === "none") return results;
    const col = sort.column;
    const dir = sort.direction;
    return [...results].sort((a, b) => {
      const av = getSortValue(a, col);
      const bv = getSortValue(b, col);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [results, sort]);

  if (loading) {
    return (
      <div className="results-list" role="table" aria-label="Search results loading" aria-busy="true">
        <SortHeader sort={sort} onSort={handleSort} />
        <div role="rowgroup">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "var(--text-muted)", margin: "0 auto 0.75rem", display: "block" }}
          aria-hidden="true"
        >
          <circle cx="18" cy="18" r="11" />
          <path d="M27 27L35 35" strokeLinecap="round" />
          <path d="M13 18h10M18 13v10" strokeLinecap="round" />
        </svg>
        <strong style={{ color: "var(--text-secondary)", fontSize: 15 }}>No results found</strong>
        <p>Try adjusting your search terms or filters.</p>
      </div>
    );
  }

  return (
    <div
      className="results-list"
      role="table"
      aria-label="Search results"
      aria-rowcount={results.length}
    >
      <SortHeader sort={sort} onSort={handleSort} />
      <div role="rowgroup">
        {sortedResults.map((item, index) => (
          <ResultRow
            key={item._id ?? String(index)}
            item={item}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  );
};

export default ResultsList;
