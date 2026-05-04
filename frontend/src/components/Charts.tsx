import React from "react";
import type { AnalyticsCategory } from "../api";

type ChartsProps = {
  data: AnalyticsCategory[];
  visible: boolean;
  onLoad: () => void;
};

const Charts: React.FC<ChartsProps> = ({ data, visible, onLoad }) => {
  if (!visible) {
    return (
      <div className="analytics-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 0.5rem", display: "block", color: "var(--text-muted)" }}>
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
        <button
          type="button"
          onClick={onLoad}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
            fontWeight: 500,
            padding: 0,
          }}
        >
          Load analytics →
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map((point) => point.value), 1);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
      <div className="sidebar-label" style={{ marginBottom: "1rem" }}>Top Categories</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {data.map((point) => (
          <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: 13 }}>
            <span style={{ minWidth: 80, color: "var(--text-secondary)", fontWeight: 500 }}>{point.label}</span>
            <div style={{ flex: 1, background: "var(--bg)", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: `${Math.round((point.value / maxValue) * 100)}%`,
                  borderRadius: 4,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span style={{ minWidth: 50, textAlign: "right", color: "var(--text-muted)", fontFamily: "DM Mono, monospace", fontSize: 12 }}>
              {point.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Charts;
