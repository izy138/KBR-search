import { useMemo, useRef } from "react";
import { useChartCursorTooltip } from "../../hooks/useChartCursorTooltip";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../../utils/cn";
import {
  CHART_TOOLTIP_ROUNDED_STYLE,
  CLS_CHART_CURSOR_TOOLTIP,
  CLS_RECHARTS_FOCUS_RESET,
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_WRAPPER_STYLE,
} from "../../utils/chartStyles";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { YearDataPoint } from "../../api";
import { buildNumericAxisDomain } from "../../utils/chartAxis";
import { formatDollarsCompact } from "../../utils/format";

interface LineChartPanelProps {
  title: string;
  data: YearDataPoint[];
  /** Optional formatter for the funding axis/tooltip values */
  formatter?: (value: number) => string;
  height?: number;
  /** Extra class on the outer panel wrapper for chart-specific layout/CSS */
  panelClassName?: string;
  chartMargin?: { top?: number; right?: number; bottom?: number; left?: number };
}

/**
 * Dual-axis line chart showing project count (left axis) and
 * total funding (right axis) over fiscal years.
 */
export default function LineChartPanel({
  title,
  data,
  formatter,
  height = 300,
  panelClassName,
  chartMargin = { top: 12, right: 16, bottom: 4, left: 8 },
}: LineChartPanelProps) {
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const { chartHoverActive, handleChartMouseMove, handleChartMouseLeave } =
    useChartCursorTooltip(chartBodyRef);
  const fundingFmt = formatter ?? formatDollarsCompact;

  const { countAxisDomain, fundingAxisDomain } = useMemo(() => {
    let minCount = Number.POSITIVE_INFINITY;
    let maxCount = Number.NEGATIVE_INFINITY;
    let minFunding = Number.POSITIVE_INFINITY;
    let maxFunding = Number.NEGATIVE_INFINITY;

    for (const point of data) {
      minCount = Math.min(minCount, point.count);
      maxCount = Math.max(maxCount, point.count);
      minFunding = Math.min(minFunding, point.total_funding);
      maxFunding = Math.max(maxFunding, point.total_funding);
    }

    if (data.length === 0) {
      return {
        countAxisDomain: [0, 1] as [number, number],
        fundingAxisDomain: [0, 1] as [number, number],
      };
    }

    return {
      countAxisDomain: buildNumericAxisDomain(minCount, maxCount),
      fundingAxisDomain: buildNumericAxisDomain(minFunding, maxFunding),
    };
  }, [data]);

  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!chartHoverActive || !props.active || !props.payload?.length) return null;

    return (
      <div className={cn(CLS_CHART_CURSOR_TOOLTIP, "z-10")} style={CHART_TOOLTIP_ROUNDED_STYLE}>
        <div className="text-text-primary font-semibold mb-1 text-[0.82rem]">FY {props.label}</div>
        {props.payload.map((entry) => {
          const rawValue = entry.value;
          const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
          const displayValue =
            entry.dataKey === "total_funding"
              ? fundingFmt(numericValue)
              : numericValue.toLocaleString();

          return (
            <div key={entry.dataKey as string} className="text-text-secondary" style={{ color: entry.color }}>
              {entry.name}: {displayValue}
            </div>
          );
        })}
      </div>
    );
  };

  const panelClass = cn(
    "bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] min-h-[310px]",
    CLS_RECHARTS_FOCUS_RESET,
    panelClassName,
  );

  return (
    <div className={panelClass}>
      <div className="text-text-primary text-[0.9rem] font-semibold mb-[0.65rem]">{title}</div>
      <div
        ref={chartBodyRef}
        className={CLS_RECHARTS_FOCUS_RESET}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
      >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 13, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            domain={countAxisDomain}
            allowDataOverflow
            tick={{ fontSize: 13, fill: "var(--text-secondary)" }}
            tickFormatter={(v: number) => v.toLocaleString()}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={fundingAxisDomain}
            allowDataOverflow
            tick={{ fontSize: 13, fill: "var(--text-secondary)" }}
            tickFormatter={fundingFmt}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            active={chartHoverActive ? undefined : false}
            content={renderTooltip}
            contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
            wrapperStyle={RECHARTS_TOOLTIP_WRAPPER_STYLE}
            position={{ x: 16, y: 16 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="count"
            name="Projects"
            stroke="#1a56db"
            strokeWidth={2}
            dot={{ r: 3, fill: "#1a56db", strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total_funding"
            name="Total Funding"
            stroke="#0e9f6e"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0e9f6e", strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
