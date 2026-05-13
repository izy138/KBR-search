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
import activityCodeDefinitions from "../../activityCodeDefinitions.json";
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

/** Log below 20k; linear from 20k to axis max on the IC projects chart. */
const IC_HYBRID_LINEAR_MIN = 20_000;
const IC_HYBRID_LINEAR_MAX_ALL = 77_000;
const IC_HYBRID_LOG_MIN = 10;
const IC_HYBRID_LOG_RATIO = 0.38;

function roundUpToThousand(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}

function icProjectsValueToPlot(value: number, linearMax: number): number {
  const v = Math.max(value, IC_HYBRID_LOG_MIN);
  const cappedMax = Math.max(linearMax, IC_HYBRID_LOG_MIN);

  if (cappedMax <= IC_HYBRID_LINEAR_MIN) {
    const logMin = Math.log10(IC_HYBRID_LOG_MIN);
    const logMax = Math.log10(cappedMax);
    return (Math.log10(Math.min(v, cappedMax)) - logMin) / (logMax - logMin);
  }

  if (v >= IC_HYBRID_LINEAR_MIN) {
    return (
      IC_HYBRID_LOG_RATIO +
      (1 - IC_HYBRID_LOG_RATIO) *
        (Math.min(v, cappedMax) - IC_HYBRID_LINEAR_MIN) /
        (cappedMax - IC_HYBRID_LINEAR_MIN)
    );
  }
  const logMin = Math.log10(IC_HYBRID_LOG_MIN);
  const logMax = Math.log10(IC_HYBRID_LINEAR_MIN);
  return (IC_HYBRID_LOG_RATIO * (Math.log10(v) - logMin)) / (logMax - logMin);
}

function icProjectsPlotToValue(plot: number, linearMax: number): number {
  const cappedMax = Math.max(linearMax, IC_HYBRID_LOG_MIN);

  if (cappedMax <= IC_HYBRID_LINEAR_MIN) {
    const logMin = Math.log10(IC_HYBRID_LOG_MIN);
    const logMax = Math.log10(cappedMax);
    return 10 ** (logMin + plot * (logMax - logMin));
  }

  if (plot >= IC_HYBRID_LOG_RATIO) {
    return (
      IC_HYBRID_LINEAR_MIN +
      ((plot - IC_HYBRID_LOG_RATIO) / (1 - IC_HYBRID_LOG_RATIO)) *
        (cappedMax - IC_HYBRID_LINEAR_MIN)
    );
  }
  const logMin = Math.log10(IC_HYBRID_LOG_MIN);
  const logMax = Math.log10(IC_HYBRID_LINEAR_MIN);
  return 10 ** (logMin + (plot / IC_HYBRID_LOG_RATIO) * (logMax - logMin));
}

const IC_HYBRID_TICK_VALUES_ALL = [
  100, 500, 1000, 5000, 10000, 20000, 30000, 40000, 50000, 77000,
] as const;

function buildIcHybridTickValues(linearMax: number): number[] {
  const cappedMax = Math.max(linearMax, 1000);
  const logTicks = [100, 500, 1000, 5000, 10000].filter((tick) => tick < cappedMax);

  if (cappedMax > IC_HYBRID_LINEAR_MIN) {
    for (let tick = IC_HYBRID_LINEAR_MIN; tick < cappedMax; tick += 10_000) {
      logTicks.push(tick);
    }
  }

  if (!logTicks.includes(cappedMax)) {
    logTicks.push(cappedMax);
  }

  return logTicks;
}

const IC_CHART_YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;

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
  /** Log scale for Projects by Institute (IC) bar chart — matches prior default. */
  const [icProjectsLogScale, setIcProjectsLogScale] = useState(true);
  const [selectedIcYear, setSelectedIcYear] = useState<number | "all">("all");
  const [icChartData, setIcChartData] = useState<IcDataPoint[]>([]);
  const [icChartLoading, setIcChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadIcChart = async () => {
      setIcChartLoading(true);
      try {
        const icYearData =
          selectedIcYear === "all"
            ? await getIcData()
            : await getIcData(selectedIcYear);
        if (!cancelled) {
          setIcChartData(icYearData);
        }
      } catch {
        if (!cancelled) {
          setIcChartData([]);
        }
      } finally {
        if (!cancelled) {
          setIcChartLoading(false);
        }
      }
    };

    void loadIcChart();

    return () => {
      cancelled = true;
    };
  }, [selectedIcYear]);

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
  const icChartRows = icChartData
    .map((point) => ({
      ...point,
      short_label: abbreviateChartCategoryLabel(point.label),
      full_label: point.label,
    }))
    .sort((a, b) => a.full_label.localeCompare(b.full_label));

  const icChartDataMax = icChartData.reduce((max, point) => Math.max(max, point.value), 0);
  const icChartLinearMax =
    selectedIcYear === "all"
      ? IC_HYBRID_LINEAR_MAX_ALL
      : Math.max(roundUpToThousand(icChartDataMax), 1000);
  const icChartTickValues =
    selectedIcYear === "all"
      ? [...IC_HYBRID_TICK_VALUES_ALL]
      : buildIcHybridTickValues(icChartLinearMax);

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
        <div className="dashboard-ic-chart-scroll">
          <BarChartPanel
            title="Projects by Institute (IC)"
            panelClassName="chart-panel-ic-projects"
            headerCenter={
              <div
                className="chart-year-scroll"
                role="listbox"
                aria-label="Fiscal year"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedIcYear === "all"}
                  className={selectedIcYear === "all" ? "active" : ""}
                  onClick={() => setSelectedIcYear("all")}
                >
                  All
                </button>
                {IC_CHART_YEARS.map((year) => (
                  <button
                    key={year}
                    type="button"
                    role="option"
                    aria-selected={selectedIcYear === year}
                    className={selectedIcYear === year ? "active" : ""}
                    onClick={() => setSelectedIcYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            }
            headerEnd={
              <div className="chart-scale-toggle" role="group" aria-label="Count axis scale">
                <button
                  type="button"
                  className={icProjectsLogScale ? "" : "active"}
                  onClick={() => setIcProjectsLogScale(false)}
                >
                  Linear
                </button>
                <button
                  type="button"
                  className={icProjectsLogScale ? "active" : ""}
                  onClick={() => setIcProjectsLogScale(true)}
                >
                  Log
                </button>
              </div>
            }
            data={
              icChartLoading
                ? []
                : (icChartRows as unknown as Array<Record<string, unknown>>)
            }
              dataKey="value"
              labelKey="short_label"
              tooltipLabelKey="full_label"
            layout="horizontal"
            height={360}
            xAxisHeight={58}
            xAxisAngle={-45}
            xAxisFontSize={10}
            yAxisWidth={60}
            yAxisTickMargin={4}
            chartMargin={{ top: 4, right: 4, bottom: 4, left: 0 }}
            barSize={30}
            {...(icProjectsLogScale
              ? {
                  valueTransform: (value: number) =>
                    icProjectsValueToPlot(value, icChartLinearMax),
                  plotToValue: (plot: number) =>
                    icProjectsPlotToValue(plot, icChartLinearMax),
                  valueTickValues: icChartTickValues,
                  formatter: formatHybridCountTick,
                  tooltipFormatter: formatCount,
                }
              : {
                  valueScale: "linear" as const,
                  formatter: formatCount,
                  tooltipFormatter: formatCount,
                })}
          />
        </div>
      </div>

      {/* Activity full width; year + orgs in a row; avg grant full width */}
      <div className="dashboard-grid-3">
        <BarChartPanel
          title="Funding by Activity Code"
          panelClassName="chart-panel-activity"
          data={activityData as unknown as Array<Record<string, unknown>>}
          dataKey="total_funding"
          labelKey="label"
          layout="horizontal"
          formatter={formatDollars}
          color="#0e9f6e"
        />
        <LineChartPanel
          title="Projects & Funding by Year"
          panelClassName="chart-panel-year-trend"
          data={yearData}
          height={300}
          formatter={formatDollars}
        />
        <BarChartPanel
          title="Top Organizations by Funding"
          panelClassName="chart-panel-top-orgs"
          data={topOrgsChartData as unknown as Array<Record<string, unknown>>}
          dataKey="total_funding"
          labelKey="short_label"
          tooltipLabelKey="full_label"
          layout="horizontal"
          formatter={formatDollars}
        />
        <BarChartPanel
          title="Average Grant by Institute (IC)"
          panelClassName="chart-panel-avg-grant"
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
