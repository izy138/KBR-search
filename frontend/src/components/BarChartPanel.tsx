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
  formatter?: (value: number) => string;
  color?: string;
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
  formatter,
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
    const displayValue = formatter
      ? formatter(numericValue)
      : numericValue.toLocaleString();

    return (
      <div className="map-tooltip">
        <div className="map-tooltip-state">{label}</div>
        <div className="map-tooltip-row">{displayValue}</div>
      </div>
    );
  };

  const isVertical = layout === "vertical";

  return (
    <div className="chart-panel">
      <div className="chart-panel-title">{title}</div>
      <ResponsiveContainer width="100%" height={300}>
        {isVertical ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickFormatter={formatter ?? ((v: number) => v.toLocaleString())}
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
            <Tooltip content={renderTooltip} cursor={{ fill: "var(--accent-light)" }} />
            <Bar dataKey={dataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={24} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 16, bottom: 48, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              type="category"
              dataKey={labelKey}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              angle={-40}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickFormatter={formatter ?? ((v: number) => v.toLocaleString())}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: "var(--accent-light)" }} />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
