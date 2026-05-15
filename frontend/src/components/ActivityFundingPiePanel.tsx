import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ActivityFundingPieResponse, ActivityPieSlice } from "../api";

/** Wrapper height for the chart area (Recharts box). Pie radii are separate — raise this for more padding around the rings. */
const PIE_CONTAINER_HEIGHT_PX = 400;

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
const INNER_SLICE_HOVER_POPOUT_PX = 10;
const OUTER_SLICE_HOVER_POPOUT_PX = 13;
const OTHER_SLICE_HOVER_POPOUT_PX = 4;

/**
 * Two stacked `<Pie>` rings — inner (top 5) is a filled disk; outer (6…ZIF + Other) is a thin band.
 * Inner ring area > outer ring area so the center reads as the main chart.
 */
const INNER_PIE_INNER_RADIUS_PX = 0;
const INNER_PIE_OUTER_RADIUS_PX = 102;
const OUTER_PIE_INNER_RADIUS_PX = 107;
/** Outer band thickness = 50% more than the previous 34px band (34 × 1.5 ≈ 51). */
const OUTER_PIE_OUTER_RADIUS_PX = 148;

/** How far a hovered slice shifts outward (px). */
const PIE_HOVER_POPOUT_PX = 8;

const PIE_HOVER_TRANSITION = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

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
  hoverPopout: number;
  radialInset: number;
};

interface ActivityFundingPiePanelProps {
  title: string;
  pie: ActivityFundingPieResponse;
  formatDollars: (n: number) => string;
}

function rowFromSlice(s: ActivityPieSlice): PieRow {
  return {
    name: s.label,
    value: s.total_funding,
    count: s.count,
    pct: s.percent_of_funding,
    chartValue: s.total_funding,
    hoverPopout: OUTER_SLICE_HOVER_POPOUT_PX,
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
    hoverPopout: OTHER_SLICE_HOVER_POPOUT_PX,
    radialInset: OTHER_RADIAL_INSET_PX,
  };
}

function prepareRingRows(rows: PieRow[], ring: "inner" | "outer"): PieRow[] {
  const individuals = rows.filter((r) => !r.isOther);
  const otherIdx = rows.findIndex((r) => r.isOther);
  const popout = ring === "inner" ? INNER_SLICE_HOVER_POPOUT_PX : OUTER_SLICE_HOVER_POPOUT_PX;

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
        hoverPopout: OTHER_SLICE_HOVER_POPOUT_PX,
        radialInset: OTHER_RADIAL_INSET_PX,
      };
    }
    return {
      ...row,
      chartValue: row.value,
      hoverPopout: popout,
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
  hoverPopout?: number;
  radialInset?: number;
};

/** Smooth hover: named slices pop out more; Other stays smaller and barely moves. */
function SmoothPopOutSector(props: PieSectorShapeProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const startAngle = Number(props.startAngle ?? 0);
  const endAngle = Number(props.endAngle ?? 0);
  const fill = props.fill ?? "#8884d8";
  const isActive = Boolean(props.isActive);
  const isOther = Boolean(props.isOther);
  const inset = Number(props.radialInset ?? 0);
  const popoutPx = Number(
    props.hoverPopout ?? (isOther ? OTHER_SLICE_HOVER_POPOUT_PX : PIE_HOVER_POPOUT_PX),
  );
  const midAngle = (startAngle + endAngle) / 2;
  const RADIAN = Math.PI / 180;
  const offset = isActive ? popoutPx : 0;
  const dx = offset * Math.cos(-midAngle * RADIAN);
  const dy = offset * Math.sin(-midAngle * RADIAN);
  const drawInner = innerRadius + inset * 0.35;
  const drawOuter = outerRadius - inset;
  return (
    <g
      style={{
        transform: `translate(${dx}px, ${dy}px)`,
        transition: PIE_HOVER_TRANSITION,
        willChange: "transform",
      }}
    >
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={drawInner}
        outerRadius={drawOuter}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="none"
        style={{
          transition: PIE_HOVER_TRANSITION,
          filter: isActive && !isOther ? "drop-shadow(0 3px 8px rgba(0,0,0,0.22))" : "none",
          opacity: isOther ? 0.88 : 1,
        }}
      />
    </g>
  );
}

function renderPieSector(props: PieSectorShapeProps) {
  return <SmoothPopOutSector {...props} />;
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
  const groupClass = compact
    ? "activity-pie-slice-label-group activity-pie-slice-label-group--inner"
    : "activity-pie-slice-label-group";
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="middle"
      className={groupClass}
    >
      <tspan x={x} dy={compact ? "-0.45em" : "-0.55em"} className="activity-pie-slice-label__code">
        {row.isOther ? "Other" : row.name}
      </tspan>
      <tspan x={x} dy={compact ? "0.95em" : "1.05em"} className="activity-pie-slice-label__pct">
        {`${pctAll.toFixed(1)}%`}
      </tspan>
    </text>
  );
}

function sliceColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}

/**
 * Two-layer pie: inner ring = top 5 activity codes; outer ring = ranks 6–20.
 * Recharts stacks two `<Pie>` components in one `<PieChart>`.
 */
export default function ActivityFundingPiePanel({
  title,
  pie,
  formatDollars,
}: ActivityFundingPiePanelProps) {
  const [tailPanelOpen, setTailPanelOpen] = useState(false);

  const { innerChartData, outerChartData, tailDetailRows, usesZifCutoff } = useMemo(() => {
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

  const handleSliceClick = (row: PieRow | undefined) => {
    if (row?.isOther) {
      setTailPanelOpen((open) => !open);
      return;
    }
    setTailPanelOpen(false);
  };

  const slicesSum = useMemo(
    () => chartData.reduce((acc, r) => acc + r.value, 0),
    [chartData],
  );
  const pctOfAllIndexed =
    pie.total_funding_indexed > 0 ? slicesSum / pie.total_funding_indexed : 0;

  const legendPayload = useMemo(
    () =>
      chartData.map((row, index) => ({
        value: row.name,
        type: "square" as const,
        color: sliceColor(index),
        payload: row,
      })),
    [chartData],
  );

  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) {
      return null;
    }
    const row = props.payload[0]?.payload as PieRow | undefined;
    if (!row) {
      return null;
    }
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{row.name}</div>
        <div className="chart-tooltip-row">{formatDollars(row.value)}</div>
        <div className="chart-tooltip-pct-stack">
          <div className="chart-tooltip-pct-stack__code">{row.name}</div>
          <div className="chart-tooltip-row chart-tooltip-row--pct">
            {(row.pct * 100).toFixed(2)}% of all indexed funding (entire dataset)
          </div>
        </div>
        <div className="chart-tooltip-row">{row.count.toLocaleString()} projects</div>
        {row.isOther ? (
          <div className="chart-tooltip-row chart-tooltip-row--hint">
            Click slice to {tailPanelOpen ? "hide" : "show"} all codes after{" "}
            {LAST_INDIVIDUAL_ACTIVITY_CODE}
          </div>
        ) : null}
      </div>
    );
  };

  const legendFormatter = (value: string, entry: unknown) => {
    const row = (entry as { payload?: PieRow }).payload;
    if (!row) {
      return value;
    }
    const pct = (row.pct * 100).toFixed(1);
    const ring =
      innerChartData.some((r) => r.name === row.name) ? "inner" : "outer";
    return (
      <span className="activity-pie-legend-format">
        <span className="activity-pie-legend-format__code">{value}</span>
        <span className="activity-pie-legend-format__meta">
          {formatDollars(row.value)} · {ring} ring
        </span>
        <span className="activity-pie-legend-format__pct-stack">
          <span className="activity-pie-legend-format__code activity-pie-legend-format__code--above-pct">
            {value}
          </span>
          <span className="activity-pie-legend-format__pct">{pct}% of all indexed</span>
        </span>
      </span>
    );
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(pie, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-funding-pie.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (chartData.length === 0) {
    return (
      <div className="chart-panel chart-panel--pie">
        <div className="chart-panel-header">
          <h3 className="chart-panel-title">{title}</h3>
        </div>
        <p className="chart-panel-empty">No activity funding data.</p>
      </div>
    );
  }

  return (
    <div className="chart-panel chart-panel--pie">
      <div className="chart-panel-header chart-panel-header--row">
        <h3 className="chart-panel-title">{title}</h3>
        <button type="button" className="chart-json-download" onClick={downloadJson}>
          Download JSON
        </button>
      </div>
      
      
      {pie.more_activities_than_buckets ? (
        <p className="chart-panel-note">
          OpenSearch returned the top {pie.activity_buckets_fetched} activity buckets by funding;
          {pie.sum_other_doc_count.toLocaleString()} additional project rows sit outside those
          buckets. Increase the API <code className="chart-inline-code">limit</code> query param for
          fuller coverage.
        </p>
      ) : null}
      <div
        className={`chart-panel-body chart-panel-body--pie${
          tailPanelOpen && tailDetailRows.length > 0 ? " chart-panel-body--pie-with-tail" : ""
        }`}
      >
        <div
          className="chart-pie-size-host"
          style={{ height: PIE_CONTAINER_HEIGHT_PX, minHeight: PIE_CONTAINER_HEIGHT_PX }}
        >
          <ResponsiveContainer width="100%" height="100%">
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
                  isAnimationActive
                  legendType="none"
                  labelLine={false}
                  label={(props) => renderSliceLabel({ ...props, minPct: 0.8, compact: true })}
                  onClick={(_, index) => handleSliceClick(innerChartData[index])}
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
                  isAnimationActive
                  legendType="none"
                  labelLine={false}
                  label={(props) =>
                    renderSliceLabel({
                      ...props,
                      minPct: props.payload?.isOther ? 0 : 1.2,
                    })
                  }
                  onClick={(_, index) => handleSliceClick(outerChartData[index])}
                >
                  {outerChartData.map((row, index) => (
                    <Cell
                      key={`outer-cell-${index}`}
                      fill={row.isOther ? OTHER_SLICE_COLOR : sliceColor(INNER_SLICE_COUNT + index)}
                      style={row.isOther ? { cursor: "pointer" } : undefined}
                    />
                  ))}
                </Pie>
              ) : null}
              <Tooltip content={renderTooltip} />
              <Legend
                payload={legendPayload}
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={legendFormatter}
                wrapperStyle={{
                  fontSize: "12px",
                  paddingLeft: 4,
                  maxHeight: PIE_CONTAINER_HEIGHT_PX - 40,
                  overflowY: "auto",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {tailPanelOpen && tailDetailRows.length > 0 ? (
          <aside className="activity-pie-tail-panel" aria-label="Activity codes after ZIF">
            <div className="activity-pie-tail-panel__header">
              <h4 className="activity-pie-tail-panel__title">
                After {LAST_INDIVIDUAL_ACTIVITY_CODE}
              </h4>
              <button
                type="button"
                className="activity-pie-tail-panel__close"
                onClick={() => setTailPanelOpen(false)}
                aria-label="Close list"
              >
                ×
              </button>
            </div>
            <p className="activity-pie-tail-panel__summary">
              {tailDetailRows.length} codes ·{" "}
              {formatDollars(tailDetailRows.reduce((acc, r) => acc + r.value, 0))}
            </p>
            <ul className="activity-pie-tail-panel__list">
              {tailDetailRows.map((row) => (
                <li key={row.name} className="activity-pie-tail-panel__item">
                  <span className="activity-pie-tail-panel__code">{row.name}</span>
                  <span className="activity-pie-tail-panel__meta">
                    {formatDollars(row.value)} · {(row.pct * 100).toFixed(2)}%
                  </span>
                  <span className="activity-pie-tail-panel__count">
                    {row.count.toLocaleString()} projects
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
