import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFilterCatalog } from "../../hooks/useFilterCatalog";
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
} from "../../api";
import type {
  ActivityDataPoint,
  ActivityFundingPieResponse,
  AvgGrantDataPoint,
  DashboardSummary,
  IcDataPoint,
  OrgDataPoint,
  ProjectTermThemeCloudResponse,
  StateDataPoint,
  YearDataPoint,
} from "../../api";
import ActivityFundingPiePanel from "../charts/ActivityFundingPiePanel";
import BarChartPanel from "../charts/BarChartPanel";
import Filters from "../search/Filters";
import type { FilterValues } from "../../types/filters";
import LineChartPanel from "../charts/LineChartPanel";
import ProjectTermsThemeCloud from "./ProjectTermsThemeCloud";
import TermCloud from "./TermCloud";
import StateMap from "./StateMap";
import { formatDollarsCompact } from "../../utils/format";
import { cn } from "../../utils/cn";

// ─── Formatting helpers ───────────────────────────────────────────────────────

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

/** Recharts box height for the year trend line chart. */
const YEAR_LINE_CHART_HEIGHT = 320;
/** Recharts box height for the activity funding pie (larger to fit scaled ring radii). */
const ACTIVITY_PIE_CHART_HEIGHT = 360;

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

export type DashboardSearchFilters = FilterValues;

type DashboardProps = {
  onSearchNavigate: (query: string, filters: DashboardSearchFilters) => void;
  onTermSearchNavigate: (terms: string[], filters: DashboardSearchFilters) => void;
};

// ─── KPI card subcomponent ────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-[0.9rem] text-center">
      <div className="text-accent text-[1.45rem] font-bold leading-[1.2] font-mono">{value}</div>
      <div className="text-text-secondary text-[0.8125rem] mt-[0.375rem]">{label}</div>
    </div>
  );
}

// ─── Main Dashboard component ─────────────────────────────────────────────────

/**
 * Analytics dashboard that fetches all data in parallel on mount and
 * renders KPI cards, a choropleth map, and multiple chart panels.
 */
export default function Dashboard({ onSearchNavigate, onTermSearchNavigate }: DashboardProps) {
  const hasLoadedOnceRef = useRef(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const filterCatalog = useFilterCatalog();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPI, setSelectedPI] = useState("");
  const [selectedIC, setSelectedIC] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [fyMin, setFyMin] = useState("");
  const [fyMax, setFyMax] = useState("");
  /** Log scale for Projects by Institute (IC) — only when no filters are applied. */
  const [icProjectsLogScale, setIcProjectsLogScale] = useState(true);
  const mapMeasureRef = useRef<HTMLDivElement>(null);
  const [mapMeasureHeight, setMapMeasureHeight] = useState<number | undefined>();

  const hasIcFilter = Boolean(selectedIC);

  useEffect(() => {
    const measureEl = mapMeasureRef.current;
    if (!measureEl) return;

    const updateHeight = (): void => {
      setMapMeasureHeight(measureEl.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(measureEl);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [data?.stateData, refreshing]);

  const measuredSlotStyle =
    mapMeasureHeight != null
      ? { height: mapMeasureHeight, maxHeight: mapMeasureHeight }
      : undefined;

  const mainChartSlotStyle = measuredSlotStyle;

  const hasActiveFilters = useMemo(
    () => Boolean(selectedPI || selectedIC || selectedActivity || selectedState || fyMin || fyMax),
    [selectedPI, selectedIC, selectedActivity, selectedState, fyMin, fyMax],
  );

  useEffect(() => {
    if (hasActiveFilters) {
      setIcProjectsLogScale(false);
    } else {
      setIcProjectsLogScale(true);
    }
  }, [hasActiveFilters]);

  const icProjectsUseLogScale = !hasActiveFilters && icProjectsLogScale;

  const icChartLinearMax = IC_HYBRID_LINEAR_MAX_ALL;
  const icChartTickValues = [...IC_HYBRID_TICK_VALUES_ALL];

  const dashboardFilters = useMemo<DashboardSearchFilters>(
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

  const handleDashboardSearch = useCallback((nextQuery: string) => {
    onSearchNavigate(nextQuery, dashboardFilters);
  }, [dashboardFilters, onSearchNavigate]);

  const handleTermBrowseSearch = useCallback((terms: string[]) => {
    onTermSearchNavigate(terms, dashboardFilters);
  }, [dashboardFilters, onTermSearchNavigate]);

  const handleMapStateSelect = (stateAbbrev: string) => {
    setSelectedState(stateAbbrev.toUpperCase());
  };

  const handleIcBarClick = (row: Record<string, unknown>) => {
    const institute =
      (typeof row.full_label === "string" && row.full_label.trim())
      || (typeof row.label === "string" && row.label.trim())
      || "";
    if (institute) {
      setSelectedIC(institute);
    }
  };

  const icChartRows = useMemo((): Array<Record<string, unknown>> => {
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

    const load = async () => {
      if (hasLoadedOnceRef.current) {
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
          getDashboardSummary(dashboardFilters),
          getStateData(dashboardFilters),
          getIcData(undefined, dashboardFilters),
          getActivityData(80, dashboardFilters),
          getActivityFundingPie({ limit: 500, pieSlices: 20 }, dashboardFilters),
          getProjectTermThemeCloud(),
          getYearData(dashboardFilters),
          getTopOrgs(dashboardFilters),
          getAvgGrantByIc(dashboardFilters),
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
          hasLoadedOnceRef.current = true;
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
  }, [dashboardFilters]);

  if (error) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        <span>Unable to load dashboard: {error}</span>
      </div>
    );
  }

  if (!data || !filterCatalog) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
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

  const topOrgsChartData: Array<Record<string, unknown>> = topOrgs.map((point) => ({
    ...point,
    short_label: abbreviateChartCategoryLabel(point.label),
    full_label: point.label,
  }));

  const avgGrantChartData: Array<Record<string, unknown>> = avgGrant.map((point) => ({
    ...point,
    short_label: abbreviateChartCategoryLabel(point.label),
    full_label: point.label,
  }));

  const topOrgsPanel = (
    <BarChartPanel
      title="Top Organizations by Funding"
      panelClassName="min-h-[310px]"
      data={topOrgsChartData}
      dataKey="total_funding"
      labelKey="short_label"
      tooltipLabelKey="full_label"
      layout="horizontal"
      formatter={formatDollarsCompact}
      fillHeight={hasIcFilter}
    />
  );

  const icProjectsPanel = (
    <BarChartPanel
      title="Projects by Institute (IC)"
      panelClassName="min-h-0 w-full max-w-full px-4 pt-[0.9rem] pb-[0.05rem] [&_.recharts-responsive-container]:-ml-3 [&_.recharts-responsive-container]:-mb-[0.35rem] [&_.recharts-responsive-container]:!w-[calc(100%+12px)]"
      headerEnd={
        <div className="inline-flex border border-border rounded-[--radius-sm] shrink-0 overflow-hidden" role="group" aria-label="Count axis scale">
          <button
            type="button"
            className={cn("bg-surface border-none text-text-secondary cursor-pointer font-[inherit] text-[0.8125rem] font-medium px-[0.65rem] py-[0.35rem] transition-[background,color] duration-150 hover:bg-surface-hover hover:text-text-primary", !icProjectsUseLogScale && "!bg-accent !text-white")}
            onClick={() => setIcProjectsLogScale(false)}
          >
            Linear
          </button>
          <button
            type="button"
            className={cn("bg-surface border-none text-text-secondary cursor-pointer font-[inherit] text-[0.8125rem] font-medium px-[0.65rem] py-[0.35rem] transition-[background,color] duration-150 hover:bg-surface-hover hover:text-text-primary border-l border-border", icProjectsUseLogScale && "!bg-accent !text-white")}
            onClick={() => setIcProjectsLogScale(true)}
            disabled={hasActiveFilters}
            title={hasActiveFilters ? "Log scale is only available with no filters applied" : undefined}
          >
            Log
          </button>
        </div>
      }
      data={icChartRows}
      dataKey="value"
      labelKey="short_label"
      tooltipLabelKey="full_label"
      layout="horizontal"
      fillHeight
      xAxisHeight={58}
      xAxisAngle={-45}
      xAxisFontSize={12}
      yAxisFontSize={12}
      yAxisWidth={60}
      yAxisTickMargin={4}
      chartMargin={{ top: 4, right: 4, bottom: 4, left: 0 }}
      barCategoryGap="10%"
      maxBarSize={30}
      barAnimation="vertical"
      barAnimationSnapKey={icProjectsUseLogScale ? "hybrid-log" : "linear"}
      onBarClick={handleIcBarClick}
      {...(icProjectsUseLogScale
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
  );

  const activityPiePanel = (
    <ActivityFundingPiePanel
      title="Funding by Activity Code"
      pie={activityPie}
      formatDollars={formatDollarsCompact}
      chartHeight={ACTIVITY_PIE_CHART_HEIGHT}
    />
  );

  return (
    <div className={cn("w-full px-6 py-[1.1rem] flex flex-col", refreshing && "opacity-[0.72] transition-opacity duration-200")}>
      <Filters
        applied={dashboardFilters}
        catalog={{
          icNames,
          activityCodes,
          states,
          fiscalYearOptions: filterCatalog.fiscalYearOptions,
        }}
        onSearch={handleDashboardSearch}
        searchSubmitOnClear={false}
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

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 my-3 max-[900px]:grid-cols-2 max-[500px]:grid-cols-1">
        <KpiCard label="Total Funding" value={formatDollarsCompact(summary.total_funding)} />
        <KpiCard label="Total Projects" value={formatCount(summary.total_documents)} />
        <KpiCard label="Avg Grant" value={formatDollarsCompact(avgGrantValue)} />
      </div>

      {/* State map + main chart slot (IC projects or top orgs when IC filtered) */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-full min-w-0 max-[768px]:grid-cols-1">
        <div ref={mapMeasureRef} className="col-start-1 row-start-1 self-start min-w-0 max-[768px]:col-auto max-[768px]:row-auto">
          <StateMap
            data={stateData}
            selectedStateAbbrev={selectedState}
            onStateSelect={handleMapStateSelect}
          />
        </div>
        <div className="col-start-2 col-end-[-1] row-start-1 self-start min-w-0 overflow-hidden w-full max-w-full max-[768px]:col-auto max-[768px]:row-auto" style={mainChartSlotStyle}>
          {hasIcFilter ? topOrgsPanel : icProjectsPanel}
        </div>
        <div className="col-span-full row-start-2 grid grid-cols-2 gap-3 items-stretch min-w-0 max-[768px]:grid-cols-1 max-[768px]:col-auto max-[768px]:row-auto">
          <div className="flex flex-col min-w-0">
            <LineChartPanel
              title="Projects & Funding by Year"
              panelClassName="min-h-[330px] flex-1"
              data={yearData}
              height={YEAR_LINE_CHART_HEIGHT}
              formatter={formatDollarsCompact}
            />
          </div>
          <div className="flex flex-col min-w-0">{activityPiePanel}</div>
        </div>
      </div>

      <div className="mt-[0.85rem] w-full">
        <ProjectTermsThemeCloud payload={termThemeCloud} />
        <TermCloud onSearch={handleTermBrowseSearch} />
      </div>

      <div className="grid grid-cols-2 gap-[0.85rem] [&>*:last-child]:col-span-full max-[768px]:grid-cols-1">
        {!hasIcFilter && topOrgsPanel}
        <BarChartPanel
          title="Average Grant by Institute (IC)"
          panelClassName="min-h-[310px]"
          data={avgGrantChartData}
          dataKey="avg_grant"
          labelKey="short_label"
          tooltipLabelKey="full_label"
          layout="horizontal"
          formatter={formatDollarsCompact}
          xAxisFontSize={12}
          yAxisFontSize={12}
          color="#7c3aed"
        />
      </div>
    </div>
  );
}
