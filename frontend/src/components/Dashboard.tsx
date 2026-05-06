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
import LineChartPanel from "./LineChartPanel";
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

  const avgGrantValue =
    summary.total_documents > 0
      ? summary.total_funding / summary.total_documents
      : 0;

  return (
    <div className="dashboard">
      {/* KPI cards */}
      <div className="kpi-cards">
        <KpiCard label="Total Funding" value={formatDollars(summary.total_funding)} />
        <KpiCard label="Projects" value={formatCount(summary.total_documents)} />
        <KpiCard label="Institutes (ICs)" value={formatCount(summary.unique_ics)} />
        <KpiCard label="Avg Grant" value={formatDollars(avgGrantValue)} />
      </div>

      {/* State map + IC bar chart */}
      <div className="dashboard-grid-2">
        <StateMap data={stateData} />
        <BarChartPanel
          title="Projects by Institute (IC)"
          data={icData as unknown as Array<Record<string, unknown>>}
          dataKey="value"
          labelKey="label"
          layout="vertical"
          formatter={formatCount}
        />
      </div>

      {/* Activity funding — full width */}
      <BarChartPanel
        title="Funding by Activity Code"
        data={activityData as unknown as Array<Record<string, unknown>>}
        dataKey="total_funding"
        labelKey="label"
        layout="horizontal"
        formatter={formatDollars}
        color="#0e9f6e"
      />

      {/* Year trend + top orgs */}
      <div className="dashboard-grid-2">
        <LineChartPanel
          title="Projects & Funding by Year"
          data={yearData}
          formatter={formatDollars}
        />
        <BarChartPanel
          title="Top Organizations by Funding"
          data={topOrgs as unknown as Array<Record<string, unknown>>}
          dataKey="total_funding"
          labelKey="label"
          layout="vertical"
          formatter={formatDollars}
        />
      </div>

      {/* Avg grant by IC — full width */}
      <BarChartPanel
        title="Average Grant by Institute (IC)"
        data={avgGrant as unknown as Array<Record<string, unknown>>}
        dataKey="avg_grant"
        labelKey="label"
        layout="horizontal"
        formatter={formatDollars}
        color="#7c3aed"
      />
    </div>
  );
}
