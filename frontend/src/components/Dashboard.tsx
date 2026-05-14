import { useEffect, useMemo, useRef, useState } from "react";
import {
  getActivityData,
  getActivityFundingPie,
  getAvgGrantByIc,
  getDashboardSummary,
  getIcData,
  getProjectTermThemeCloud,
  getStateData,
  getTopOrgs,
  getYearData,
} from "../api";
import type {
  ActivityDataPoint,
  ActivityFundingPieResponse,
  AnalyticsFilterOptions,
  AvgGrantDataPoint,
  DashboardSummary,
  IcDataPoint,
  OrgDataPoint,
  ProjectTermThemeCloudResponse,
  StateDataPoint,
  YearDataPoint,
} from "../api";
import ActivityFundingPiePanel from "./ActivityFundingPiePanel";
import BarChartPanel from "./BarChartPanel";
import Filters, { type FiltersHandle } from "./Filters";
import LineChartPanel from "./LineChartPanel";
import ProjectTermsThemeCloud from "./ProjectTermsThemeCloud";
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

/** Log below 20k; linear from 20k to axis max on the IC projects chart. */
const IC_HYBRID_LINEAR_MIN = 20_000;
const IC_HYBRID_LINEAR_MAX_ALL = 77_000;
const IC_HYBRID_LOG_MIN = 10;
const IC_HYBRID_LOG_RATIO = 0.38;

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
  activityPie: ActivityFundingPieResponse;
  termThemeCloud: ProjectTermThemeCloudResponse;
  yearData: YearDataPoint[];
  topOrgs: OrgDataPoint[];
  avgGrant: AvgGrantDataPoint[];
}

export type DashboardSearchFilters = {
  pi: string;
  ic: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
};

type DashboardProps = {
  onSearchNavigate: (query: string, filters: DashboardSearchFilters) => void;
};

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
export default function Dashboard({ onSearchNavigate }: DashboardProps) {
  const filtersRef = useRef<FiltersHandle>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [filterCatalog, setFilterCatalog] = useState<{
    icNames: string[];
    activityCodes: string[];
    states: string[];
    fiscalYearOptions: number[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPI, setSelectedPI] = useState("");
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");
  /** Log scale for Projects by Institute (IC) bar chart — matches prior default. */
  const [icProjectsLogScale, setIcProjectsLogScale] = useState(true);

  const icChartLinearMax = IC_HYBRID_LINEAR_MAX_ALL;
  const icChartTickValues = [...IC_HYBRID_TICK_VALUES_ALL];

  const appliedFilters = useMemo<AnalyticsFilterOptions>(
    () => ({
      pi: selectedPI,
      ic: selectedIC,
      activity: selectedActivity,
      state: selectedState,
      fyMin,
      fyMax,
    }),
    [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax],
  );

  const searchFilters = useMemo<DashboardSearchFilters>(
    () => ({
      pi: selectedPI,
      ic: selectedIC,
      activity: selectedActivity,
      state: selectedState,
      fyMin,
      fyMax,
    }),
    [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax],
  );

  const handleDashboardSearch = (nextQuery: string) => {
    const filters =
      filtersRef.current?.applyPendingFilters()
      ?? filtersRef.current?.getPendingFilters()
      ?? searchFilters;
    onSearchNavigate(nextQuery, filters);
  };

  const icChartRows = useMemo(() => {
    const icData = data?.icData ?? [];
    return icData
      .map((point) => ({
        ...point,
        short_label: abbreviateChartCategoryLabel(point.label),
        full_label: point.label,
      }))
      .sort((a, b) => a.full_label.localeCompare(b.full_label));
  }, [data?.icData]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const [icData, activityData, stateData, yearData] = await Promise.all([
          getIcData(),
          getActivityData(80),
          getStateData(),
          getYearData(),
        ]);
        if (!cancelled) {
          setFilterCatalog({
            icNames: icData.map((point) => point.label),
            activityCodes: activityData.map((point) => point.label),
            states: stateData.map((point) => point.state),
            fiscalYearOptions: yearData.map((d) => d.year),
          });
        }
      } catch {
        if (!cancelled) {
          setFilterCatalog(null);
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (data) {
        setRefreshing(true);
      }
      try {
        const [
          summary,
          stateData,
          icData,
          activityData,
          activityPie,
          termThemeCloud,
          yearData,
          topOrgs,
          avgGrant,
        ] = await Promise.all([
          getDashboardSummary(appliedFilters),
          getStateData(appliedFilters),
          getIcData(undefined, appliedFilters),
          getActivityData(80, appliedFilters),
          getActivityFundingPie({ limit: 150, pieSlices: 12 }, appliedFilters),
          getProjectTermThemeCloud(),
          getYearData(appliedFilters),
          getTopOrgs(appliedFilters),
          getAvgGrantByIc(appliedFilters),
        ]);

        if (!cancelled) {
          setData({
            summary,
            stateData,
            icData,
            activityData,
            activityPie,
            termThemeCloud,
            yearData,
            topOrgs,
            avgGrant,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters]);

  if (error) {
    return (
      <div className="dashboard-error">
        <span>Unable to load dashboard: {error}</span>
      </div>
    );
  }

  if (!data || !filterCatalog) {
    return (
      <div className="dashboard-loading">
        <span>Loading analytics…</span>
      </div>
    );
  }

  const { summary, stateData, activityPie, termThemeCloud, yearData, topOrgs, avgGrant } = data;
  const { icNames, activityCodes, states } = filterCatalog;

  const avgGrantValue =
    summary.total_documents > 0
      ? summary.total_funding / summary.total_documents
      : 0;

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
    <div className={`dashboard${refreshing ? " dashboard--refreshing" : ""}`}>
      <Filters
        ref={filtersRef}
        icNames={icNames}
        activityCodes={activityCodes}
        states={states}
        fiscalYearOptions={filterCatalog.fiscalYearOptions}
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
          <SearchBar onSearch={handleDashboardSearch} submitOnClear={false} />
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
            data={icChartRows as unknown as Array<Record<string, unknown>>}
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
            barCategoryGap="10%"
            maxBarSize={30}
            barAnimation="vertical"
            barAnimationSnapKey={icProjectsLogScale ? "hybrid-log" : "linear"}
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

      {/* Project term themes (word cloud) + funding by activity code (pie) */}
      <div className="dashboard-term-themes-pie-row">
        <ProjectTermsThemeCloud payload={termThemeCloud} />
        <ActivityFundingPiePanel
          title="Funding by Activity Code"
          pie={activityPie}
          formatDollars={formatDollars}
        />
      </div>

      <div className="dashboard-grid-3">
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
