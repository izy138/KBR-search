import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface BarChartPanelProps {
  title: string;
  data: Array<Record<string, unknown>>;
  /** The field name for the numeric value */
  dataKey: string;
  /** The field name for the string label */
  labelKey: string;
  /** Optional field name used for tooltip label display */
  tooltipLabelKey?: string;
  layout: "horizontal" | "vertical";
  /** Controls numeric axis scaling for charts with number values */
  valueScale?: "linear" | "log";
  /** Optional explicit numeric domain for the value axis */
  valueDomain?: [number | "auto", number | "auto"];
  /** Optional explicit tick positions for the value axis */
  valueTicks?: number[];
  /** Optional formatter dedicated to tooltip values */
  tooltipFormatter?: (value: number) => string;
  formatter?: (value: number) => string;
  color?: string;
  height?: number;
}

/**
 * Reusable bar chart panel backed by Recharts.
 *
 * Supports both horizontal (label on X-axis) and vertical (label on Y-axis)
 * orientations. Pass a `formatter` to control how tooltip values are displayed.
 */
export default function BarChartPanel({
  title,
  data,
  dataKey,
  labelKey,
  tooltipLabelKey,
  layout,
  valueScale = "linear",
  valueDomain,
  valueTicks,
  tooltipFormatter,
  formatter,
  height = 500,
  color = "#1a56db",
}: BarChartPanelProps) {
  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;
    const entry = props.payload[0];
    const rawValue = entry.value;
    const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
    const rawTooltipLabel = entry.payload?.[tooltipLabelKey ?? labelKey];
    const label =
      typeof rawTooltipLabel === "string" && rawTooltipLabel.trim().length > 0
        ? rawTooltipLabel
        : (props.label as string);
    const displayValue = tooltipFormatter
      ? tooltipFormatter(numericValue)
      : formatter
        ? formatter(numericValue)
      : numericValue.toLocaleString();

    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{label}</div>
        <div className="chart-tooltip-row">{displayValue}</div>
      </div>
    );
  };

  const isVertical = layout === "vertical";
  const useLogScale = valueScale === "log";
  const axisDomain: [number | "auto", number | "auto"] = valueDomain ?? (useLogScale ? [1, "auto"] : ["auto", "auto"]);

  return (
    <div className="chart-panel">
      <div className="chart-panel-title">{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        {isVertical ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickFormatter={formatter ?? ((v: number) => v.toLocaleString())}
              scale={useLogScale ? "log" : "auto"}
              domain={axisDomain}
              ticks={valueTicks}
              interval={0}
              allowDataOverflow={useLogScale}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={labelKey}
              width={140}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: "var(--accent-light)" }}
              position={{ x: 16, y: 16 }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={24} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              type="category"
              dataKey={labelKey}
              height={90}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              angle={-40}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={100}
              tickMargin={9}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickFormatter={formatter ?? ((v: number) => v.toLocaleString())}
              scale={useLogScale ? "log" : "auto"}
              domain={axisDomain}
              ticks={valueTicks}
              interval={0}
              allowDataOverflow={useLogScale}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: "var(--accent-light)" }}
              position={{ x: 16, y: 16 }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
