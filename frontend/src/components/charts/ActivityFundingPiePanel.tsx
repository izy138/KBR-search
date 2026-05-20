import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChartCursorTooltip } from "../../hooks/useChartCursorTooltip";
import type { MouseEvent } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ActivityFundingPieResponse, ActivityPieSlice } from "../../api";
import { cn } from "../../utils/cn";
import { CLS_RECHARTS_FOCUS_RESET } from "../../utils/chartStyles";

const DEFAULT_CHART_HEIGHT_PX = 360;

/** Inner ring = top N activity codes; outer = codes 6…ZIF plus one “Other” slice. */
const INNER_SLICE_COUNT = 5;
/** Last activity code shown as its own slice; everything after rolls into Other. */
const LAST_INDIVIDUAL_ACTIVITY_CODE = "ZIF";
const FALLBACK_OUTER_SLICE_COUNT = 15;
const OTHER_SLICE_COLOR = "#64748b";
/** Cap Other wedge size vs. named slices on the same ring (chart angles only). */
const OTHER_SLICE_MAX_VS_RING = 0.07;
/** Other sits inset in the outer ring so it reads smaller. */
const OTHER_RADIAL_INSET_PX = 13;

/**
 * Two stacked `<Pie>` rings — inner (top 5) is a filled disk; outer (6…ZIF + Other) is a thin band.
 * Inner ring area > outer ring area so the center reads as the main chart.
 */
const INNER_PIE_INNER_RADIUS_PX = 0;
const INNER_PIE_OUTER_RADIUS_PX = 120;
const OUTER_PIE_INNER_RADIUS_PX = 126;
/** Outer band thickness = 50% more than the previous 34px band (34 × 1.5 ≈ 51). */
const OUTER_PIE_OUTER_RADIUS_PX = 175;

const PIE_HOVER_OUTER_EXPAND_PX = 5;
const PIE_HOVER_STROKE_WIDTH = 2;
const PIE_SLICE_HOVER_TRANSITION = "fill 0.15s ease, stroke 0.15s ease, opacity 0.15s ease";

const PIE_COLORS = [
  "#1a56db",
  "#0e9f6e",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#a16207",
  "#4f46e5",
  "#0f766e",
  "#c026d3",
  "#b45309",
  "#0369a1",
];

type PieRow = {
  name: string;
  value: number;
  count: number;
  pct: number;
  isOther?: boolean;
  /** Angular size in the pie (may be less than `value` for the Other slice). */
  chartValue: number;
  radialInset: number;
};

interface ActivityFundingPiePanelProps {
  title: string;
  pie: ActivityFundingPieResponse;
  formatDollars: (n: number) => string;
  /** Recharts container height; should match the paired year trend chart on the dashboard. */
  chartHeight?: number;
  /** When true, dims the chart while filtered analytics are refetching. */
  loading?: boolean;
  /** Currently applied activity filter (highlights matching tail list item). */
  selectedActivity?: string;
  /** When set, tail list codes apply that activity as a dashboard filter. */
  onActivitySelect?: (activityCode: string) => void;
}

function rowFromSlice(s: ActivityPieSlice): PieRow {
  return {
    name: s.label,
    value: s.total_funding,
    count: s.count,
    pct: s.percent_of_funding,
    chartValue: s.total_funding,
    radialInset: 0,
  };
}

function buildOtherAggregateRow(tail: PieRow[], totalIndexed: number): PieRow {
  const value = tail.reduce((acc, r) => acc + r.value, 0);
  const count = tail.reduce((acc, r) => acc + r.count, 0);
  const denom = totalIndexed > 0 ? totalIndexed : value || 1;
  return {
    name: `Other (${tail.length} codes)`,
    value,
    count,
    pct: value / denom,
    isOther: true,
    chartValue: value,
    radialInset: OTHER_RADIAL_INSET_PX,
  };
}

function prepareRingRows(rows: PieRow[], ring: "inner" | "outer"): PieRow[] {
  const individuals = rows.filter((r) => !r.isOther);
  const otherIdx = rows.findIndex((r) => r.isOther);

  let chartValueByOther = 0;
  if (otherIdx >= 0 && individuals.length > 0) {
    const individualsTotal = individuals.reduce((acc, r) => acc + r.value, 0);
    const largest = Math.max(...individuals.map((r) => r.value));
    const cap = Math.max(
      individualsTotal * OTHER_SLICE_MAX_VS_RING,
      largest * 0.35,
    );
    chartValueByOther = Math.min(rows[otherIdx].value, cap);
  }

  return rows.map((row) => {
    if (row.isOther) {
      return {
        ...row,
        chartValue: otherIdx >= 0 ? chartValueByOther : row.value,
        radialInset: OTHER_RADIAL_INSET_PX,
      };
    }
    return {
      ...row,
      chartValue: row.value,
      radialInset: 0,
    };
  });
}

function splitPieRows(pie: ActivityFundingPieResponse): {
  innerChartData: PieRow[];
  outerChartData: PieRow[];
  tailDetailRows: PieRow[];
  usesZifCutoff: boolean;
} {
  const ordered = [
    ...pie.slices.map(rowFromSlice),
    ...(pie.tail_slices ?? []).map(rowFromSlice),
  ];
  const zifIdx = ordered.findIndex((r) => r.name === LAST_INDIVIDUAL_ACTIVITY_CODE);

  if (zifIdx < 0) {
    const inner = ordered.slice(0, INNER_SLICE_COUNT);
    const outer = ordered.slice(INNER_SLICE_COUNT, INNER_SLICE_COUNT + FALLBACK_OUTER_SLICE_COUNT);
    const tailDetailRows = ordered.slice(INNER_SLICE_COUNT + FALLBACK_OUTER_SLICE_COUNT);
    return { innerChartData: inner, outerChartData: outer, tailDetailRows, usesZifCutoff: false };
  }

  const individual = ordered.slice(0, zifIdx + 1);
  const tailDetailRows = ordered.slice(zifIdx + 1);
  const innerChartData = individual.slice(0, INNER_SLICE_COUNT);
  const outerIndividuals = individual.slice(INNER_SLICE_COUNT);
  const outerChartData =
    tailDetailRows.length > 0
      ? [...outerIndividuals, buildOtherAggregateRow(tailDetailRows, pie.total_funding_indexed)]
      : outerIndividuals;

  return { innerChartData, outerChartData, tailDetailRows, usesZifCutoff: true };
}

type PieSectorShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  isActive?: boolean;
  isOther?: boolean;
  radialInset?: number;
  payload?: PieRow;
  onClick?: (event: MouseEvent<SVGPathElement>) => void;
  sliceClickable?: boolean;
  isSelectedSlice?: boolean;
};

function lightenHexColor(hex: string, amount = 0.16): string {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 3 && normalized.length !== 6) {
    return hex;
  }
  const full =
    normalized.length === 3
      ? normalized.split("").map((char) => char + char).join("")
      : normalized;
  const mix = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const r = mix(parseInt(full.slice(0, 2), 16));
  const g = mix(parseInt(full.slice(2, 4), 16));
  const b = mix(parseInt(full.slice(4, 6), 16));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Hover: lighter fill, slice-color outline, outer edge expands slightly. */
function HighlightedPieSector(props: PieSectorShapeProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const startAngle = Number(props.startAngle ?? 0);
  const endAngle = Number(props.endAngle ?? 0);
  const fill = props.fill ?? "#8884d8";
  const isActive = Boolean(props.isActive);
  const isOther = Boolean(props.isOther ?? props.payload?.isOther);
  const isSelectedSlice = Boolean(props.isSelectedSlice);
  const sliceClickable = Boolean(props.sliceClickable) && !isOther;
  const inset = Number(props.radialInset ?? 0);
  const drawInner = innerRadius + inset * 0.35;
  const drawOuter = outerRadius - inset;
  const hoverExpand = isOther ? PIE_HOVER_OUTER_EXPAND_PX * 0.6 : PIE_HOVER_OUTER_EXPAND_PX;
  const activeOuter = isActive ? drawOuter + hoverExpand : drawOuter;
  const sectorFill = isActive ? lightenHexColor(fill, isOther ? 0.12 : 0.18) : fill;
  const showStroke = isActive || isSelectedSlice;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={drawInner}
      outerRadius={activeOuter}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={sectorFill}
      stroke={showStroke ? fill : "none"}
      strokeWidth={showStroke ? PIE_HOVER_STROKE_WIDTH : 0}
      onClick={props.onClick}
      style={{
        transition: PIE_SLICE_HOVER_TRANSITION,
        opacity: isOther && !isActive ? 0.88 : 1,
        outline: "none",
        cursor: sliceClickable ? "pointer" : undefined,
      }}
    />
  );
}

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  payload?: { name: string; pct: number; isOther?: boolean };
  minPct?: number;
  compact?: boolean;
};

/** Activity code + % of all indexed funding on each slice. */
function renderSliceLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  payload,
  minPct = 2.5,
  compact = false,
}: SliceLabelProps) {
  const row = payload;
  if (
    row == null ||
    cx == null ||
    cy == null ||
    midAngle == null ||
    innerRadius == null ||
    outerRadius == null
  ) {
    return null;
  }
  const pctAll = row.pct * 100;
  if (pctAll < minPct) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      style={{ pointerEvents: "none" }}
    >
      <tspan
        x={x}
        dy={compact ? "-0.45em" : "-0.55em"}
        style={{ fill: "#fff", fontWeight: 700, paintOrder: "stroke fill", stroke: "rgba(15,23,42,0.5)", strokeWidth: "2px" }}
      >
        {row.isOther ? "Other" : row.name}
      </tspan>
      <tspan
        x={x}
        dy={compact ? "0.95em" : "1.05em"}
        style={{ fill: "#fff", fontWeight: 600, paintOrder: "stroke fill", stroke: "rgba(15,23,42,0.45)", strokeWidth: "2px" }}
      >
        {`${pctAll.toFixed(1)}%`}
      </tspan>
    </text>
  );
}

function sliceColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

function isPieRow(entry: PieRow | { payload?: PieRow }): entry is PieRow {
  return "name" in entry && typeof entry.name === "string";
}

function pieRowFromClickEntry(entry: PieRow | { payload?: PieRow }): PieRow | undefined {
  if (isPieRow(entry)) {
    return entry;
  }
  return entry.payload;
}

/**
 * Two-layer pie: inner ring = top 5 activity codes; outer ring = ranks 6–20.
 * Recharts stacks two `<Pie>` components in one `<PieChart>`.
 */
export default function ActivityFundingPiePanel({
  title,
  pie,
  formatDollars,
  chartHeight = DEFAULT_CHART_HEIGHT_PX,
  loading = false,
  selectedActivity = "",
  onActivitySelect,
}: ActivityFundingPiePanelProps) {
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const { chartHoverActive, handleChartMouseMove, handleChartMouseLeave } =
    useChartCursorTooltip(chartBodyRef);

  const { innerChartData, outerChartData, tailDetailRows } = useMemo(() => {
    const split = splitPieRows(pie);
    return {
      ...split,
      innerChartData: prepareRingRows(split.innerChartData, "inner"),
      outerChartData: prepareRingRows(split.outerChartData, "outer"),
    };
  }, [pie]);

  const chartData = useMemo(
    () => [...innerChartData, ...outerChartData],
    [innerChartData, outerChartData],
  );

  const showTailPanel = tailDetailRows.length > 0;

  const pieRingCount =
    (innerChartData.length > 0 ? 1 : 0) + (outerChartData.length > 0 ? 1 : 0);
  const [pieAnimationActive, setPieAnimationActive] = useState(true);
  const pieAnimationEndsRef = useRef(0);

  useEffect(() => {
    setPieAnimationActive(true);
    pieAnimationEndsRef.current = 0;
  }, [pie, innerChartData, outerChartData]);

  useEffect(() => {
    if (!pieAnimationActive || pieRingCount === 0) return;
    const timeoutId = window.setTimeout(() => {
      setPieAnimationActive(false);
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [pieAnimationActive, pieRingCount, pie]);

  const handlePieAnimationEnd = useCallback(() => {
    pieAnimationEndsRef.current += 1;
    if (pieAnimationEndsRef.current >= pieRingCount) {
      setPieAnimationActive(false);
    }
  }, [pieRingCount]);

  const handlePieSliceClick = useCallback(
    (entry: PieRow | { payload?: PieRow }) => {
      const row = pieRowFromClickEntry(entry);
      if (row == null || row.isOther || onActivitySelect == null || !row.name) {
        return;
      }
      onActivitySelect(row.name);
    },
    [onActivitySelect],
  );

  const renderPieSector = useCallback(
    (props: PieSectorShapeProps) => {
      const row = props.payload;
      const isSelectedSlice = row != null && row.name === selectedActivity;
      const sliceClickable = onActivitySelect != null && row != null && !row.isOther;
      return (
        <HighlightedPieSector
          {...props}
          isSelectedSlice={isSelectedSlice}
          sliceClickable={sliceClickable}
        />
      );
    },
    [onActivitySelect, selectedActivity],
  );

  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!chartHoverActive || !props.active || !props.payload?.length) {
      return null;
    }
    const row = props.payload[0]?.payload as PieRow | undefined;
    if (!row) {
      return null;
    }
    const codeLabel = row.isOther ? "Other" : row.name;
    return (
      <div className="bg-surface border border-border rounded-[--radius-md] shadow-md min-w-0 px-[0.68rem] py-[0.45rem] text-[14px] leading-[1.25] pointer-events-none z-10">
        <div className="flex flex-wrap items-baseline gap-x-[0.45rem] gap-y-[0.3rem] whitespace-nowrap">
          <span className="font-bold text-text-primary">{codeLabel}</span>
          <span className="text-text-muted select-none">·</span>
          <span>{formatDollars(row.value)}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-[0.45rem] gap-y-[0.3rem] whitespace-nowrap text-text-muted mt-[0.15rem]">
          {row.count.toLocaleString()} projects
        </div>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div
      className={cn(
        "bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] text-[14px] min-h-0 transition-opacity duration-200",
        loading && "opacity-50 pointer-events-none",
      )}
    >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-[0.65rem]">
          <div className="text-text-primary text-[0.9rem] font-semibold mb-0">{title}</div>
        </div>
        <p className="text-text-muted text-[0.875rem] mt-2 m-0">No activity funding data.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] text-[14px] min-h-0 transition-opacity duration-200",
        loading && "opacity-50 pointer-events-none",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-[0.65rem]">
        <div className="text-text-primary text-[0.9rem] font-semibold mb-0">{title}</div>
      </div>

      {pie.more_activities_than_buckets ? (
        <p className="text-text-secondary text-[0.75rem] leading-[1.45] m-0 mb-2 font-[inherit]">
          OpenSearch returned the top {pie.activity_buckets_fetched} activity buckets by funding;
          {pie.sum_other_doc_count.toLocaleString()} additional project rows sit outside those
          buckets. Increase the API <code className="bg-tag-bg rounded-[4px] font-mono text-[0.72rem] px-[0.3rem] py-[0.1rem]">limit</code> query param for
          fuller coverage.
        </p>
      ) : null}
      <div className={showTailPanel ? "grid grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)] gap-3 items-stretch min-h-[360px] px-1 pb-1" : "min-h-[360px] min-w-0 px-1 pb-1"}>
        <div
          ref={chartBodyRef}
          className={cn(
            "w-full min-w-0 overflow-visible [&_svg]:overflow-visible [&_svg]:text-[inherit]",
            CLS_RECHARTS_FOCUS_RESET,
          )}
          style={{ height: chartHeight, minHeight: chartHeight }}
          onMouseMove={handleChartMouseMove}
          onMouseLeave={handleChartMouseLeave}
        >
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <PieChart margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
              {innerChartData.length > 0 ? (
                <Pie
                  data={innerChartData}
                  dataKey="chartValue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={INNER_PIE_INNER_RADIUS_PX}
                  outerRadius={INNER_PIE_OUTER_RADIUS_PX}
                  paddingAngle={0}
                  stroke="none"
                  shape={renderPieSector}
                  animationDuration={700}
                  animationEasing="ease-out"
                  isAnimationActive={pieAnimationActive}
                  onAnimationEnd={handlePieAnimationEnd}
                  legendType="none"
                  labelLine={false}
                  label={(props) => renderSliceLabel({ ...props, minPct: 0.8, compact: true })}
                  onClick={onActivitySelect ? handlePieSliceClick : undefined}
                >
                  {innerChartData.map((_, index) => (
                    <Cell key={`inner-cell-${index}`} fill={sliceColor(index)} />
                  ))}
                </Pie>
              ) : null}
              {outerChartData.length > 0 ? (
                <Pie
                  data={outerChartData}
                  dataKey="chartValue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={OUTER_PIE_INNER_RADIUS_PX}
                  outerRadius={OUTER_PIE_OUTER_RADIUS_PX}
                  paddingAngle={0}
                  stroke="none"
                  shape={renderPieSector}
                  animationDuration={700}
                  animationEasing="ease-out"
                  isAnimationActive={pieAnimationActive}
                  onAnimationEnd={handlePieAnimationEnd}
                  legendType="none"
                  labelLine={false}
                  label={(props) =>
                    renderSliceLabel({
                      ...props,
                      minPct: props.payload?.isOther ? 0 : 1.2,
                    })
                  }
                  onClick={onActivitySelect ? handlePieSliceClick : undefined}
                >
                  {outerChartData.map((row, index) => (
                    <Cell
                      key={`outer-cell-${index}`}
                      fill={row.isOther ? OTHER_SLICE_COLOR : sliceColor(INNER_SLICE_COUNT + index)}
                    />
                  ))}
                </Pie>
              ) : null}
              <Tooltip
                active={chartHoverActive ? undefined : false}
                content={renderTooltip}
                isAnimationActive={false}
                animationDuration={0}
                wrapperStyle={{ transition: "none", outline: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {showTailPanel ? (
          <aside className="flex flex-col min-h-0 max-h-[360px] pl-[0.9rem] pr-1 py-[0.85rem] border border-border-strong rounded-[--radius-md] bg-bg" aria-label="Other Activity Codes">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="m-0 font-bold leading-[1.25]">
                Other Activity Codes
              </h4>
            </div>
            <p className="m-0 mb-[0.35rem] leading-[1] text-text-muted ">
              {tailDetailRows.length} codes ·{" "}
              {formatDollars(tailDetailRows.reduce((acc, r) => acc + r.value, 0))}
            </p>
            <ul className="flex-1 min-h-0 m-0 p-0 pr-6 -mr-1 list-none overflow-y-auto [scrollbar-width:thin]">
              {tailDetailRows.map((row) => {
                const isSelected = selectedActivity === row.name;
                const rowInnerClass =
                  "flex w-full flex-col gap-0 rounded-md py-1 px-1.5 text-[0.8125rem] leading-[1.05]";
                const rowBody = (
                  <>
                    <div className="flex items-baseline justify-between gap-[0.35rem] min-w-0">
                      <span className="font-bold tracking-[0.02em] shrink-0">{row.name}</span>
                      <span className="text-text-secondary text-right whitespace-nowrap">{formatDollars(row.value)}</span>
                    </div>
                    <span className="text-text-muted">
                      {row.count.toLocaleString()} projects
                    </span>
                  </>
                );

                if (onActivitySelect == null) {
                  return (
                    <li
                      key={row.name}
                      className="border-b-2 border-border-strong px-1.5 py-1 last:border-b-0"
                    >
                      <div className={rowInnerClass}>{rowBody}</div>
                    </li>
                  );
                }

                return (
                  <li
                    key={row.name}
                    className="border-b-2 border-border-strong px-1.5 py-1 last:border-b-0"
                  >
                    <button
                      type="button"
                      className={cn(
                        rowInnerClass,
                        "appearance-none cursor-pointer border-none bg-transparent text-left font-[inherit] transition-[background,color] duration-150 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1",
                        isSelected && "bg-accent-light text-accent-text hover:bg-accent-light",
                      )}
                      aria-pressed={isSelected}
                      aria-label={`Filter dashboard by activity code ${row.name}`}
                      onClick={() => onActivitySelect(row.name)}
                    >
                      {rowBody}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
