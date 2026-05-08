import { useEffect, useState } from "react";
import {
  getActivityData,
  getAvgGrantByIc,
  getDashboardSummary,
  getIcData,
  getStateData,
  getTopOrgs,
  getYearData,
} from "../api";
import type {
  ActivityDataPoint,
  AvgGrantDataPoint,
  DashboardSummary,
  IcDataPoint,
  OrgDataPoint,
  StateDataPoint,
  YearDataPoint,
} from "../api";
import BarChartPanel from "./BarChartPanel";
import Filters from "./Filters";
import LineChartPanel from "./LineChartPanel";
import SearchBar from "./SearchBar";
import StateMap from "./StateMap";

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Formats a dollar amount with B/M/K suffixes for display.
 */
function formatDollars(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}

/**
 * Formats a count with locale-aware separators.
 */
function formatCount(n: number): string {
  return n.toLocaleString();
}

/**
 * Formats count ticks for compact chart axes (e.g., 1k, 3k, 6k, 12k).
 */
function formatHybridCountTick(n: number): string {
  if (n >= 1e3) {
    return `${Math.round(n / 1e3)}k`;
  }
  return n.toLocaleString();
}

/**
 * Shortens long institute or organization names for chart axes; pair with
 * `full_label` on the same row for tooltips.
 */
function abbreviateChartCategoryLabel(label: string): string {
  const trimmed = label.trim();
  const parenMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].trim();
  }

  const words = trimmed
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const filtered = words.filter((word) => !["of", "and", "the", "for"].includes(word.toLowerCase()));

  if (filtered.length >= 2) {
    return filtered.map((word) => word[0]?.toUpperCase() ?? "").join("").slice(0, 8);
  }

  if (trimmed.length <= 12) {
    return trimmed;
  }

  return `${trimmed.slice(0, 10)}…`;
}

// ─── Types for combined dashboard state ──────────────────────────────────────

interface DashboardData {
  summary: DashboardSummary;
  stateData: StateDataPoint[];
  icData: IcDataPoint[];
  activityData: ActivityDataPoint[];
  yearData: YearDataPoint[];
  topOrgs: OrgDataPoint[];
  avgGrant: AvgGrantDataPoint[];
}

// ─── KPI card subcomponent ────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-value">{value}</div>
      <div className="kpi-card-label">{label}</div>
    </div>
  );
}

// ─── Main Dashboard component ─────────────────────────────────────────────────

/**
 * Analytics dashboard that fetches all data in parallel on mount and
 * renders KPI cards, a choropleth map, and multiple chart panels.
 */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [selectedPI, setSelectedPI] = useState("");
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [summary, stateData, icData, activityData, yearData, topOrgs, avgGrant] =
          await Promise.all([
            getDashboardSummary(),
            getStateData(),
            getIcData(),
            getActivityData(),
            getYearData(),
            getTopOrgs(),
            getAvgGrantByIc(),
          ]);

        if (!cancelled) {
          setData({ summary, stateData, icData, activityData, yearData, topOrgs, avgGrant });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="dashboard-error">
        <span>Unable to load dashboard: {error}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-loading">
        <span>Loading analytics…</span>
      </div>
    );
  }

  const { summary, stateData, icData, activityData, yearData, topOrgs, avgGrant } = data;
  const icNames = icData.map((point) => point.label);
  const activityCodes = activityData.map((point) => point.label);
  const states = stateData.map((point) => point.state);

  const avgGrantValue =
    summary.total_documents > 0
      ? summary.total_funding / summary.total_documents
      : 0;
  const icChartData = icData
    .map((point) => ({
      ...point,
      short_label: abbreviateChartCategoryLabel(point.label),
      full_label: point.label,
    }))
    .sort((a, b) => a.full_label.localeCompare(b.full_label));

  const topOrgsChartData = topOrgs.map((point) => ({
    ...point,
    short_label: abbreviateChartCategoryLabel(point.label),
    full_label: point.label,
  }));

  const avgGrantChartData = avgGrant.map((point) => ({
    ...point,
    short_label: abbreviateChartCategoryLabel(point.label),
    full_label: point.label,
  }));

  return (
    <div className="dashboard">
      <Filters
        icNames={icNames}
        activityCodes={activityCodes}
        states={states}
        selectedPI={selectedPI}
        selectedIC={selectedIC}
        selectedActivity={selectedActivity}
        selectedState={selectedState}
        fyMin={fyMin}
        fyMax={fyMax}
        onApply={(filters) => {
          setSelectedPI(filters.pi);
          setSelectedIC(filters.ic);
          setSelectedActivity(filters.activity);
          setSelectedState(filters.state);
          setFyMin(filters.fyMin);
          setFyMax(filters.fyMax);
        }}
        onClear={() => {
          setSelectedPI("");
          setSelectedIC("");
          setSelectedActivity("");
          setSelectedState("");
          setFyMin("");
          setFyMax("");
        }}
      />

      <div className="search-row">
        <div className="search-row-inner">
          <SearchBar onSearch={setDashboardQuery} initialQuery={dashboardQuery} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-cards">
        <KpiCard label="Total Funding" value={formatDollars(summary.total_funding)} />
        <KpiCard label="Total Projects" value={formatCount(summary.total_documents)} />
        <KpiCard label="Avg Grant" value={formatDollars(avgGrantValue)} />
      </div>

      {/* State map + IC bar chart */}
      <div className="dashboard-grid-2">
        <StateMap data={stateData} />
        <BarChartPanel
          title="Projects by Institute (IC)"
          data={icChartData as unknown as Array<Record<string, unknown>>}
          dataKey="value"
          labelKey="short_label"
          tooltipLabelKey="full_label"
          layout="horizontal"
          valueScale="log"
          valueDomain={[5, 12000]}
          valueTicks={[5, 10, 100, 500, 1000, 3000, 6000, 12000]}
          formatter={formatHybridCountTick}
          tooltipFormatter={formatCount}
        />
      </div>

      {/* Activity full width; year + orgs in a row; avg grant full width */}
      <div className="dashboard-grid-3">
        <BarChartPanel
          title="Funding by Activity Code"
          data={activityData as unknown as Array<Record<string, unknown>>}
          dataKey="total_funding"
          labelKey="label"
          layout="horizontal"
          formatter={formatDollars}
          color="#0e9f6e"
        />
        <LineChartPanel
          title="Projects & Funding by Year"
          data={yearData}
          formatter={formatDollars}
        />
        <BarChartPanel
          title="Top Organizations by Funding"
          data={topOrgsChartData as unknown as Array<Record<string, unknown>>}
          dataKey="total_funding"
          labelKey="short_label"
          tooltipLabelKey="full_label"
          layout="horizontal"
          formatter={formatDollars}
        />
        <BarChartPanel
          title="Average Grant by Institute (IC)"
          data={avgGrantChartData as unknown as Array<Record<string, unknown>>}
          dataKey="avg_grant"
          labelKey="short_label"
          tooltipLabelKey="full_label"
          layout="horizontal"
          formatter={formatDollars}
          color="#7c3aed"
        />
      </div>
    </div>
  );
}
