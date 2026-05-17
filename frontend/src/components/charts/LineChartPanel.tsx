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
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { YearDataPoint } from "../../api";
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
  chartMargin = { top: 4, right: 16, bottom: 4, left: 8 },
}: LineChartPanelProps) {
  const fundingFmt = formatter ?? formatDollarsCompact;

  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;

    return (
      <div className="bg-surface border border-border rounded-[--radius-md] shadow-md text-[0.8125rem] px-[0.875rem] py-[0.625rem] pointer-events-none min-w-[160px] z-10">
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

  const panelClass = cn("bg-surface border border-border rounded-[--radius-lg] w-full px-4 py-[0.9rem] min-h-[310px]", panelClassName);

  return (
    <div className={panelClass}>
      <div className="text-text-primary text-[0.9rem] font-semibold mb-[0.65rem]">{title}</div>
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
