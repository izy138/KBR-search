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
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { YearDataPoint } from "../api";

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

const defaultFundingFormatter = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value}`;
};

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
  chartMargin = { top: 4, right: 16, bottom: 4, left: 8 },
}: LineChartPanelProps) {
  const fundingFmt = formatter ?? defaultFundingFormatter;

  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">FY {props.label}</div>
        {props.payload.map((entry) => {
          const rawValue = entry.value;
          const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
          const displayValue =
            entry.dataKey === "total_funding"
              ? fundingFmt(numericValue)
              : numericValue.toLocaleString();

          return (
            <div key={entry.dataKey as string} className="chart-tooltip-row" style={{ color: entry.color }}>
              {entry.name}: {displayValue}
            </div>
          );
        })}
      </div>
    );
  };

  const panelClass = panelClassName
    ? `chart-panel ${panelClassName}`
    : "chart-panel";

  return (
    <div className={panelClass}>
      <div className="chart-panel-title">{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            tickFormatter={(v: number) => v.toLocaleString()}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            tickFormatter={fundingFmt}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={renderTooltip} position={{ x: 16, y: 16 }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="count"
            name="Projects"
            stroke="#1a56db"
            strokeWidth={2}
            dot={{ r: 3, fill: "#1a56db" }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total_funding"
            name="Total Funding"
            stroke="#0e9f6e"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0e9f6e" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
