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
import { toAnalyticsFilterOptions } from "../../utils/analyticsFilters";
import LineChartPanel from "../charts/LineChartPanel";
import ProjectTermsThemeCloud from "./ProjectTermsThemeCloud";
import TermCloud from "./TermCloud";
import StateMap from "./StateMap";
import { buildIcProjectsHybridAxisScale } from "../../utils/chartAxis";
import { formatDollarsCompact } from "../../utils/format";
import { cn } from "../../utils/cn";
import HelpTooltip from "../shared/HelpTooltip";
import {
  HELP_DASHBOARD,
  HELP_DASHBOARD_FILTER_ACTIVITY,
  HELP_DASHBOARD_FILTER_FY,
  HELP_DASHBOARD_FILTER_IC,
  HELP_DASHBOARD_FILTER_ORG,
  HELP_DASHBOARD_FILTER_PI,
} from "../../utils/helpContent";

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
const IC_HYBRID_LINEAR_MAX_ALL = 80_000;
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
  100, 500, 1000, 5000, 10000, 20000, 30000, 40000, 50000, 80000,
] as const;

/** Recharts box height for the year trend line chart. */
const YEAR_LINE_CHART_HEIGHT = 320;
/** Recharts box height for the activity funding pie (larger to fit scaled ring radii). */
const ACTIVITY_PIE_CHART_HEIGHT = 360;

/** Grid cell — stretches to match sibling in the map + main-chart row. */
const MAP_CHART_ROW_CELL_CLASS = "flex h-full min-h-[310px] min-w-0 flex-col";

/** Shared layout for the map-adjacent main chart slot (IC projects + top orgs when IC filtered). */
const MAIN_CHART_SLOT_PANEL_CLASS =
  "flex h-full min-h-0 w-full max-w-full flex-1 flex-col px-4 pt-[0.9rem] pb-0 [&_.recharts-responsive-container]:-ml-3 [&_.recharts-responsive-container]:!w-[calc(100%+12px)]";

const MAIN_CHART_SLOT_BAR_PROPS = {
  layout: "horizontal" as const,
  fillHeight: true,
  xAxisHeight: 46,
  xAxisAngle: -45,
  xAxisFontSize: 12,
  yAxisFontSize: 12,
  yAxisWidth: 60,
  yAxisTickMargin: 4,
  chartMargin: { top: 4, right: 4, bottom: 4, left: 0 },
  barCategoryGap: "10%",
  maxBarSize: 30,
};

/** IC projects chart: minimal bottom padding; plot fills panel via fillHeight. */
const IC_PROJECTS_PANEL_CLASS = cn(
  MAIN_CHART_SLOT_PANEL_CLASS,
  "!pt-2 pb-0 [&_.recharts-responsive-container]:!mb-0",
);
const IC_PROJECTS_CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 };
const IC_PROJECTS_BAR_OVERRIDES = {
  xAxisHeight: 68,
  xAxisTickDy: -4,
};

/** Pie/year-trend row — same chart styling as main slot, sized to match LineChartPanel. */
const SECONDARY_CHART_ROW_PANEL_CLASS = cn(
  MAIN_CHART_SLOT_PANEL_CLASS,
  "flex-1 min-h-[330px]",
);

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

type DashboardProps = {
  searchQuery: string;
  onUpdateDashboard: (query: string) => void;
  onSearchNavigate: (query: string) => void;
  appliedFilters: FilterValues;
  onApplyFilters: (filters: FilterValues) => void;
  onClearFilters: () => void;
  onTermSearchNavigate: (terms: string[]) => void;
  onViewAllProjects: () => void;
  onYearSearchNavigate: (year: number) => void;
};

// ─── KPI card subcomponent ────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  onClick?: () => void;
}

function KpiCard({ label, value, onClick }: KpiCardProps) {
  const content = (
    <>
      <div className="text-accent text-[1.45rem] font-bold leading-[1.2] font-mono">{value}</div>
      <div className="text-text-secondary text-[0.8125rem] mt-[0.375rem]">{label}</div>
    </>
  );
  const className = cn(
    "bg-surface border border-border rounded-lg px-4 py-[0.9rem] text-center w-full",
    onClick
      && "cursor-pointer transition-[border-color,background,box-shadow] duration-150 hover:border-accent hover:bg-surface-hover hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`${label}: ${value}. View all projects in search`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

// ─── Main Dashboard component ─────────────────────────────────────────────────

/**
 * Analytics dashboard that fetches all data in parallel on mount and
 * renders KPI cards, a choropleth map, and multiple chart panels.
 */
export default function Dashboard({
  searchQuery,
  onUpdateDashboard,
  onSearchNavigate,
  appliedFilters,
  onApplyFilters,
  onClearFilters,
  onTermSearchNavigate,
  onViewAllProjects,
  onYearSearchNavigate,
}: DashboardProps) {
  const hasLoadedOnceRef = useRef(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const filterCatalog = useFilterCatalog();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Log (hybrid) vs linear scale for Projects by Institute (IC); defaults log, linear when state/activity filtered. */
  const [icProjectsLogScale, setIcProjectsLogScale] = useState(true);
  const [filterActivityHover, setFilterActivityHover] = useState<string | null>(null);

  const hasIcFilter = Boolean(appliedFilters.ic);
  const hasActivityFilter = Boolean(appliedFilters.activity);

  const analyticsOptions = useMemo(
    () => toAnalyticsFilterOptions(appliedFilters, searchQuery),
    [appliedFilters, searchQuery],
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchQuery.trim()
        || appliedFilters.pi
        || appliedFilters.ic
        || appliedFilters.org
        || appliedFilters.activity
        || appliedFilters.state
        || appliedFilters.fyMin
        || appliedFilters.fyMax,
      ),
    [appliedFilters, searchQuery],
  );

  const icProjectsDefaultLinear = Boolean(
    appliedFilters.state || appliedFilters.activity,
  );

  useEffect(() => {
    if (icProjectsDefaultLinear) {
      setIcProjectsLogScale(false);
    } else if (!hasActiveFilters) {
      setIcProjectsLogScale(true);
    }
  }, [icProjectsDefaultLinear, hasActiveFilters]);

  const icProjectsUseLogScale = icProjectsLogScale;

  const handleTermBrowseSearch = useCallback((terms: string[]) => {
    onTermSearchNavigate(terms);
  }, [onTermSearchNavigate]);

  const handleMapStateSelect = (stateAbbrev: string) => {
    onApplyFilters({ ...appliedFilters, state: stateAbbrev.toUpperCase() });
  };

  const handleIcBarClick = (row: Record<string, unknown>) => {
    const institute =
      (typeof row.full_label === "string" && row.full_label.trim())
      || (typeof row.label === "string" && row.label.trim())
      || "";
    if (institute) {
      onApplyFilters({ ...appliedFilters, ic: institute });
    }
  };

  const handleYearClick = useCallback(
    (point: YearDataPoint) => {
      if (point.year != null) {
        onYearSearchNavigate(point.year);
      }
    },
    [onYearSearchNavigate],
  );

  const handleTopOrgBarClick = (row: Record<string, unknown>) => {
    const org =
      (typeof row.full_label === "string" && row.full_label.trim())
      || (typeof row.label === "string" && row.label.trim())
      || "";
    if (org) {
      onApplyFilters({ ...appliedFilters, org });
    }
  };

  const handleActivitySelect = useCallback((activityCode: string) => {
    onApplyFilters({ ...appliedFilters, activity: activityCode });
  }, [appliedFilters, onApplyFilters]);

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

  const icChartHybridScale = useMemo(() => {
    if (!hasActiveFilters) {
      return {
        linearMax: IC_HYBRID_LINEAR_MAX_ALL,
        tickValues: [...IC_HYBRID_TICK_VALUES_ALL],
      };
    }
    const values = icChartRows.map((row) => Number(row.value));
    return buildIcProjectsHybridAxisScale(values, {
      hybridLinearMin: IC_HYBRID_LINEAR_MIN,
    });
  }, [icChartRows, hasActiveFilters]);

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
          getDashboardSummary(analyticsOptions),
          getStateData(analyticsOptions),
          getIcData(undefined, analyticsOptions),
          getActivityData(80, analyticsOptions),
          getActivityFundingPie({ limit: 500, pieSlices: 20 }, analyticsOptions),
          getProjectTermThemeCloud(),
          getYearData(analyticsOptions),
          getTopOrgs(analyticsOptions),
          getAvgGrantByIc(analyticsOptions),
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
  }, [analyticsOptions]);

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
  const { icNames, orgNames, activityCodes, states } = filterCatalog;

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

  const topOrgsTitle = appliedFilters.activity
    ? `Top Organizations by Funding — ${appliedFilters.activity}`
    : "Top Organizations by Funding";

  const topOrgsBarChartBase = {
    data: topOrgsChartData,
    dataKey: "total_funding",
    labelKey: "short_label",
    tooltipLabelKey: "full_label",
    formatter: formatDollarsCompact,
    onBarClick: handleTopOrgBarClick,
  };

  const topOrgsPanelMainSlot = (
    <BarChartPanel
      title={topOrgsTitle}
      panelClassName={MAIN_CHART_SLOT_PANEL_CLASS}
      {...topOrgsBarChartBase}
      {...MAIN_CHART_SLOT_BAR_PROPS}
    />
  );

  const topOrgsPanelSecondary = (
    <BarChartPanel
      title={topOrgsTitle}
      panelClassName={SECONDARY_CHART_ROW_PANEL_CLASS}
      {...topOrgsBarChartBase}
      {...MAIN_CHART_SLOT_BAR_PROPS}
    />
  );

  const topOrgsPanelFooter = (
    <BarChartPanel
      title={topOrgsTitle}
      panelClassName="min-h-[310px]"
      {...topOrgsBarChartBase}
      layout="horizontal"
    />
  );

  const icProjectsPanel = (
    <BarChartPanel
      title="Projects by Institute (IC)"
      panelClassName={IC_PROJECTS_PANEL_CLASS}
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
          >
            Log
          </button>
        </div>
      }
      data={icChartRows}
      dataKey="value"
      labelKey="short_label"
      tooltipLabelKey="full_label"
      {...MAIN_CHART_SLOT_BAR_PROPS}
      {...IC_PROJECTS_BAR_OVERRIDES}
      chartMargin={IC_PROJECTS_CHART_MARGIN}
      onBarClick={handleIcBarClick}
      {...(icProjectsUseLogScale
        ? {
            valueTransform: (value: number) =>
              icProjectsValueToPlot(value, icChartHybridScale.linearMax),
            plotToValue: (plot: number) =>
              icProjectsPlotToValue(plot, icChartHybridScale.linearMax),
            valueTickValues: icChartHybridScale.tickValues,
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

  const activityPieFilterKey = [
    searchQuery,
    appliedFilters.pi,
    appliedFilters.ic,
    appliedFilters.org,
    appliedFilters.activity,
    appliedFilters.state,
    appliedFilters.fyMin,
    appliedFilters.fyMax,
  ].join("\0");

  const activityPieTitle = (() => {
    if (appliedFilters.activity) {
      return `Funding by Activity Code — ${appliedFilters.activity}`;
    }
    if (!hasActiveFilters) {
      return "Funding by Activity Code";
    }
    const parts: string[] = [];
    if (searchQuery.trim()) parts.push(`"${searchQuery.trim()}"`);
    if (appliedFilters.ic) parts.push(appliedFilters.ic);
    if (appliedFilters.org) parts.push(appliedFilters.org);
    if (appliedFilters.state) parts.push(appliedFilters.state);
    if (appliedFilters.pi) parts.push(`PI: ${appliedFilters.pi}`);
    if (appliedFilters.fyMin || appliedFilters.fyMax) {
      parts.push(`FY ${appliedFilters.fyMin || "…"}–${appliedFilters.fyMax || "…"}`);
    }
    return `Funding by Activity Code (${parts.join(" · ")})`;
  })();

  const activityPiePanel = (
    <ActivityFundingPiePanel
      key={activityPieFilterKey}
      title={activityPieTitle}
      pie={activityPie}
      formatDollars={formatDollarsCompact}
      chartHeight={ACTIVITY_PIE_CHART_HEIGHT}
      loading={refreshing}
      selectedActivity={appliedFilters.activity}
      onActivitySelect={handleActivitySelect}
      hoveredActivityCode={filterActivityHover}
    />
  );

  const fundingByYearOrOrgsPanel = hasActivityFilter ? topOrgsPanelSecondary : activityPiePanel;

  return (
    <div className={cn("w-full px-6 py-[1.1rem] flex flex-col", refreshing && "opacity-[0.72] transition-opacity duration-200")}>
      <Filters
        applied={appliedFilters}
        catalog={{
          icNames,
          orgNames,
          activityCodes,
          states,
          fiscalYearOptions: filterCatalog.fiscalYearOptions,
        }}
        fieldHelp={{
          pi: HELP_DASHBOARD_FILTER_PI,
          ic: HELP_DASHBOARD_FILTER_IC,
          org: HELP_DASHBOARD_FILTER_ORG,
          activity: HELP_DASHBOARD_FILTER_ACTIVITY,
          fy: HELP_DASHBOARD_FILTER_FY,
        }}
        searchQuery={searchQuery}
        onSearch={onSearchNavigate}
        onUpdateDashboard={onUpdateDashboard}
        searchSubmitOnClear
        onApply={onApplyFilters}
        onClear={onClearFilters}
        onActivityCodeHover={setFilterActivityHover}
        helpTooltip={
          <HelpTooltip label={HELP_DASHBOARD.label}>{HELP_DASHBOARD.body}</HelpTooltip>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 my-3 max-[900px]:grid-cols-2 max-[500px]:grid-cols-1">
        <KpiCard label="Total Funding" value={formatDollarsCompact(summary.total_funding)} />
        <KpiCard
          label="Total Projects"
          value={formatCount(summary.total_documents)}
          onClick={onViewAllProjects}
        />
        <KpiCard label="Avg Grant" value={formatDollarsCompact(avgGrantValue)} />
      </div>

      {/* State map + main chart slot (IC projects or top orgs when IC filtered) */}
      <div className="grid grid-cols-3 items-stretch gap-3 w-full max-w-full min-w-0 max-[768px]:grid-cols-1">
        <div
          className={cn(
            MAP_CHART_ROW_CELL_CLASS,
            "col-start-1 row-start-1 max-[768px]:col-auto max-[768px]:row-auto",
          )}
        >
          <StateMap
            data={stateData}
            selectedStateAbbrev={appliedFilters.state}
            onStateSelect={handleMapStateSelect}
          />
        </div>
        <div
          className={cn(
            MAP_CHART_ROW_CELL_CLASS,
            "col-start-2 col-end-[-1] row-start-1 overflow-hidden max-[768px]:col-auto max-[768px]:row-auto",
          )}
        >
          {hasIcFilter ? topOrgsPanelMainSlot : icProjectsPanel}
        </div>
        <div className="col-span-full row-start-2 grid grid-cols-2 gap-3 items-stretch min-w-0 max-[768px]:grid-cols-1 max-[768px]:col-auto max-[768px]:row-auto">
          <div className="flex flex-col min-w-0">
            <LineChartPanel
              title="Projects & Funding by Year"
              panelClassName="min-h-[330px] flex-1"
              data={yearData}
              height={YEAR_LINE_CHART_HEIGHT}
              formatter={formatDollarsCompact}
              onYearClick={handleYearClick}
            />
          </div>
          <div className="flex flex-col min-w-0">{fundingByYearOrOrgsPanel}</div>
        </div>
      </div>

      <div className="mt-[0.85rem] w-full">
        <ProjectTermsThemeCloud payload={termThemeCloud} onSearch={handleTermBrowseSearch} />
        <TermCloud onSearch={handleTermBrowseSearch} />
      </div>

      <div className="grid grid-cols-2 gap-[0.85rem] [&>*:last-child]:col-span-full max-[768px]:grid-cols-1">
        {!hasIcFilter && !hasActivityFilter && topOrgsPanelFooter}
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
