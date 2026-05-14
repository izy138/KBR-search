import { useMemo } from "react";
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

/** Wrapper height so Recharts gets a real box in CSS grid (not the same as ring diameter). */
//PIE CHART HEIGHT
const PIE_CHART_HEIGHT_PX = 360;

/**
 * The drawn donut only — SVG pixel radii on `<Pie>`. Tune these to resize the circle itself.
 * Bigger ring: increase both (keep inner < outer). Thicker ring: lower inner or raise outer.
 */
const PIE_OUTER_RADIUS_PX = 180;
const PIE_INNER_RADIUS_PX = 68;

/** Extra radius when a slice is hovered (pop-out). */
const PIE_HOVER_POPOUT_PX = 14;

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
};

interface ActivityFundingPiePanelProps {
  title: string;
  pie: ActivityFundingPieResponse;
  formatDollars: (n: number) => string;
}

function rowsFromPie(pie: ActivityFundingPieResponse): PieRow[] {
  const fromSlice = (s: ActivityPieSlice): PieRow => ({
    name: s.label,
    value: s.total_funding,
    count: s.count,
    pct: s.percent_of_funding,
  });
  const rows = pie.slices.map(fromSlice);
  if (pie.other) {
    rows.push(fromSlice(pie.other));
  }
  return rows;
}

type SectorLike = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
};

function ActivePopOutShape(props: SectorLike) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const startAngle = Number(props.startAngle ?? 0);
  const endAngle = Number(props.endAngle ?? 0);
  const fill = props.fill ?? "#8884d8";
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + PIE_HOVER_POPOUT_PX}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }}
    />
  );
}

/**
 * Pie chart of TOTAL_COST share by NIH activity code (from OpenSearch — same
 * documents as `backend/indexer/data` after import). Includes JSON download.
 */
export default function ActivityFundingPiePanel({
  title,
  pie,
  formatDollars,
}: ActivityFundingPiePanelProps) {
  const chartData = useMemo(() => rowsFromPie(pie), [pie]);

  const slicesSum = useMemo(
    () => chartData.reduce((acc, r) => acc + r.value, 0),
    [chartData],
  );
  const pctOfAllIndexed =
    pie.total_funding_indexed > 0 ? slicesSum / pie.total_funding_indexed : 0;

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
        <div className="chart-tooltip-row">
          {(row.pct * 100).toFixed(2)}% of all indexed funding (entire dataset)
        </div>
        <div className="chart-tooltip-row">{row.count.toLocaleString()} projects</div>
      </div>
    );
  };

  /** Percent of `pie.total_funding_indexed` (API `percent_of_funding`), not share of pie only. */
  const renderSliceLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    payload?: PieRow;
  }) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, payload } = props;
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
    if (pctAll < 2.5) {
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
        dominantBaseline="central"
        className="activity-pie-slice-label"
      >
        {`${pctAll.toFixed(1)}%`}
      </text>
    );
  };

  const legendFormatter = (value: string, entry: unknown) => {
    const row = (entry as { payload?: PieRow }).payload;
    if (!row) {
      return value;
    }
    const pct = (row.pct * 100).toFixed(1);
    return (
      <span className="activity-pie-legend-format">
        <span className="activity-pie-legend-format__code">{value}</span>
        <span className="activity-pie-legend-format__meta">
          {formatDollars(row.value)} · {pct}% of all indexed
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
      <p className="chart-panel-summary">
        <strong>All indexed funding:</strong> {formatDollars(pie.total_funding_indexed)} ·{" "}
        <strong>Top {pie.slices.length} codes on chart:</strong> {formatDollars(slicesSum)} (
        {(pctOfAllIndexed * 100).toFixed(1)}% of total)
      </p>
      {pie.remainder && pie.remainder.codes_in_tail > 0 ? (
        <p className="chart-panel-note">
          Not shown as slices: {formatDollars(pie.remainder.total_funding)} across{" "}
          {pie.remainder.codes_in_tail} other codes ({pie.remainder.project_count.toLocaleString()}{" "}
          projects, {(pie.remainder.percent_of_all_indexed * 100).toFixed(1)}% of all indexed
          funding).
        </p>
      ) : null}
      {pie.more_activities_than_buckets ? (
        <p className="chart-panel-note">
          OpenSearch returned the top {pie.activity_buckets_fetched} activity buckets by funding;
          {pie.sum_other_doc_count.toLocaleString()} additional project rows sit outside those
          buckets. Increase the API <code className="chart-inline-code">limit</code> query param for
          fuller coverage.
        </p>
      ) : null}
      <div className="chart-panel-body chart-panel-body--pie">
        <div
          className="chart-pie-size-host"
          style={{ height: PIE_CHART_HEIGHT_PX, minHeight: PIE_CHART_HEIGHT_PX }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={PIE_INNER_RADIUS_PX}
                outerRadius={PIE_OUTER_RADIUS_PX}
                paddingAngle={0.6}
                activeShape={ActivePopOutShape}
                isAnimationActive
                label={renderSliceLabel}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={renderTooltip} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={legendFormatter}
                wrapperStyle={{
                  fontSize: "12px",
                  paddingLeft: 4,
                  maxHeight: PIE_CHART_HEIGHT_PX - 40,
                  overflowY: "auto",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
