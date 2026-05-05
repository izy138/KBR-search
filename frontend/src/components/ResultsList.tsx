import React from "react";
import type { SearchResultRecord } from "../api";

type ResultsListProps = {
  results: SearchResultRecord[];
  loading?: boolean;
  onOpenDetails?: (item: SearchResultRecord) => void;
};

function formatCost(value: number | undefined): string {
  if (value == null || isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

const SkeletonCard: React.FC = () => (
  <div className="skeleton-card">
    <div className="skeleton-line" style={{ width: "70%", marginBottom: 10 }} />
    <div className="skeleton-line" style={{ width: "45%", marginBottom: 8 }} />
    <div className="skeleton-line" style={{ width: "55%" }} />
  </div>
);

const ResultCard: React.FC<{
  item: SearchResultRecord;
  onOpenDetails?: (item: SearchResultRecord) => void;
}> = ({ item, onOpenDetails }) => {
  const title = item.PROJECT_TITLE ?? item.title ?? item.project_title ?? "Untitled Project";
  const pi = item.PI_NAMEs ?? "";
  const org = item.ORG_NAME ?? "";
  const city = item.ORG_CITY ?? "";
  const state = item.ORG_STATE ?? "";
  const orgLocation = [city, state].filter(Boolean).join(", ");
  const ic = item.IC_NAME ?? "";
  const fy = item.FY;
  const activity = item.ACTIVITY ?? "";
  const totalCost = item.TOTAL_COST as number | undefined;

  return (
    <div
      className="result-card"
      onClick={() => onOpenDetails?.(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails?.(item);
        }
      }}
    >
      {/* Left column */}
      <div>
        <h3 className="result-title">{title}</h3>

        <div className="result-meta-row">
          {pi && (
            <span className="result-meta-item">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="5" r="3" />
                <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" strokeLinecap="round" />
              </svg>
              {pi}
            </span>
          )}
          {org && (
            <span className="result-meta-item">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="12" height="8" rx="1" />
                <path d="M5 6V4a3 3 0 016 0v2" />
              </svg>
              {org}{orgLocation ? `, ${orgLocation}` : ""}
            </span>
          )}
          {ic && (
            <span className="result-meta-item">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v4M8 11v1" strokeLinecap="round" />
              </svg>
              {ic}
            </span>
          )}
        </div>

        <div className="result-tags">
          {activity && <span className="tag activity">{activity}</span>}
          {fy && <span className="tag fy">FY {fy}</span>}
        </div>
      </div>

      {/* Right column: cost */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span className="result-cost">{formatCost(totalCost)}</span>
        <span className="result-cost-label">total cost</span>
      </div>
    </div>
  );
};

const ResultsList: React.FC<ResultsListProps> = ({ results, loading, onOpenDetails }) => {
  if (loading) {
    return (
      <div className="results-list">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", margin: "0 auto 0.75rem", display: "block" }}>
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
    <div className="results-list">
      {results.map((item, index) => (
        <ResultCard key={item._id ?? String(index)} item={item} onOpenDetails={onOpenDetails} />
      ))}
    </div>
  );
};

export default ResultsList;
