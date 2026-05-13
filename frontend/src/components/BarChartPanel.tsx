import type { ReactNode } from "react";
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
import {
  clearVerticalBarHeightStore,
  useVerticalBarShapeRenderer,
} from "./VerticalOnlyBarShape";

let lastBarAnimationSnapKey: string | undefined;

function syncVerticalBarSnapKey(snapKey: string): void {
  if (lastBarAnimationSnapKey !== snapKey) {
    lastBarAnimationSnapKey = snapKey;
    clearVerticalBarHeightStore();
  }
}

interface BarChartPanelProps {
  title: string;
  /** Extra class on the outer panel wrapper for chart-specific layout/CSS */
  panelClassName?: string;
  /** Optional content centered in the panel header row */
  headerCenter?: ReactNode;
  /** Optional control rendered at the top-right of the panel header */
  headerEnd?: ReactNode;
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
  /** Maps a real value to linear plot space (enables hybrid/custom axes) */
  valueTransform?: (value: number) => number;
  /** Inverse of valueTransform — used for axis tick labels */
  plotToValue?: (plot: number) => number;
  /** Optional explicit numeric domain for the value axis */
  valueDomain?: [number | "auto", number | "auto"];
  /** Optional explicit tick positions for the value axis (plot space or real values with transform) */
  valueTicks?: number[];
  /** Tick positions in real-world units when using valueTransform */
  valueTickValues?: number[];
  /** Optional formatter dedicated to tooltip values */
  tooltipFormatter?: (value: number) => string;
  formatter?: (value: number) => string;
  color?: string;
  height?: number;
  /** Extra space reserved for angled category labels on horizontal charts */
  xAxisHeight?: number;
  xAxisAngle?: number;
  xAxisFontSize?: number;
  yAxisWidth?: number;
  yAxisTickMargin?: number;
  maxBarSize?: number;
  /** Fixed bar width in px; overrides dynamicBarSize and maxBarSize when set */
  barSize?: number;
  /** When true, bar width scales with category count instead of maxBarSize */
  dynamicBarSize?: boolean;
  /** Gap between bar categories (Recharts barCategoryGap) */
  barCategoryGap?: string | number;
  /** Remount the chart when this key changes (e.g. scale mode) to avoid cross-scale animation */
  chartKey?: string;
  /** `vertical` animates bar height only; `default` uses Recharts' built-in animation */
  barAnimation?: "default" | "vertical";
  /** Animate bar size changes (only applies when barAnimation is `default`) */
  animateBars?: boolean;
  /** Bars snap instantly when this key changes (pass scale mode for linear/log toggles) */
  barAnimationSnapKey?: string;
  /** Recharts outer margin */
  chartMargin?: { top?: number; right?: number; bottom?: number; left?: number };
}

/**
 * Reusable bar chart panel backed by Recharts.
 *
 * Supports both horizontal (label on X-axis) and vertical (label on Y-axis)
 * orientations. Pass a `formatter` to control how tooltip values are displayed.
 */
export default function BarChartPanel({
  title,
  panelClassName,
  headerCenter,
  headerEnd,
  data,
  dataKey,
  labelKey,
  tooltipLabelKey,
  layout,
  valueScale = "linear",
  valueTransform,
  plotToValue,
  valueDomain,
  valueTicks,
  valueTickValues,
  tooltipFormatter,
  formatter,
  height = 500,
  color = "#1a56db",
  xAxisHeight = 90,
  xAxisAngle = -40,
  xAxisFontSize = 11,
  yAxisWidth = 100,
  yAxisTickMargin = 9,
  maxBarSize = 40,
  barSize,
  dynamicBarSize = false,
  barCategoryGap = "2%",
  chartKey,
  barAnimation = "default",
  animateBars = true,
  barAnimationSnapKey = "default",
  chartMargin = { top: 4, right: 16, bottom: 24, left: 8 },
}: BarChartPanelProps) {
  const renderTooltip = (props: TooltipContentProps<ValueType, NameType>) => {
    if (!props.active || !props.payload?.length) return null;
    const entry = props.payload[0];
    const rawPayload = entry.payload as Record<string, unknown> | undefined;
    const rawFromPayload = rawPayload?.[`${dataKey}__raw`];
    const rawValue = rawFromPayload ?? entry.value;
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
  const usesValueTransform = valueTransform != null;
  const useLogScale = valueScale === "log" && !usesValueTransform;
  const plotDataKey = `${dataKey}__plot`;
  const chartData = data.map((row) => {
    const raw = Number(row[dataKey]);
    const plotValue = usesValueTransform ? valueTransform(raw) : raw;
    return {
      ...row,
      [`${dataKey}__raw`]: raw,
      [plotDataKey]: plotValue,
    };
  });
  const barDataKey = plotDataKey;

  const axisDomain: [number | "auto", number | "auto"] = usesValueTransform
    ? [0, 1]
    : valueDomain ?? (useLogScale ? [1, "auto"] : ["auto", "auto"]);

  const axisTicks = usesValueTransform
    ? valueTickValues?.map((tick) => valueTransform(tick)) ?? valueTicks
    : valueTicks;

  const axisTickFormatter = (plotValue: number): string => {
    const labelValue =
      usesValueTransform && plotToValue ? plotToValue(plotValue) : plotValue;
    return formatter ? formatter(labelValue) : labelValue.toLocaleString();
  };

  const valueAxisProps = {
    tick: { fontSize: 11, fill: "var(--text-secondary)" },
    tickFormatter: axisTickFormatter,
    scale: useLogScale ? ("log" as const) : ("linear" as const),
    domain: axisDomain,
    ticks: axisTicks,
    interval: 0 as const,
    allowDataOverflow: useLogScale,
    axisLine: false,
    tickLine: false,
  };

  const resolvedBarSize =
    barSize ??
    (dynamicBarSize && layout === "horizontal" && chartData.length > 0
      ? Math.max(16, Math.min(36, Math.floor(1100 / chartData.length)))
      : undefined);

  const panelClass = panelClassName
    ? `chart-panel ${panelClassName}`
    : "chart-panel";

  const useVerticalBarAnimation = barAnimation === "vertical";
  const verticalBarShape = useVerticalBarShapeRenderer(
    tooltipLabelKey ?? labelKey,
    barAnimationSnapKey,
  );

  if (useVerticalBarAnimation) {
    syncVerticalBarSnapKey(barAnimationSnapKey);
  }

  return (
    <div className={panelClass}>
      {headerCenter != null || headerEnd != null ? (
        <div className="chart-panel-header">
          <div className="chart-panel-title">{title}</div>
          {headerCenter != null ? (
            <div className="chart-panel-header-center">{headerCenter}</div>
          ) : null}
          {headerEnd != null ? <div className="chart-panel-header-end">{headerEnd}</div> : null}
        </div>
      ) : (
        <div className="chart-panel-title">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {isVertical ? (
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" {...valueAxisProps} />
            <YAxis
              type="category"
              dataKey={labelKey}
              width={140}
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: "var(--accent-light)" }}
              position={{ x: 16, y: 16 }}
            />
            <Bar dataKey={barDataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={24} />
          </BarChart>
        ) : (
          <BarChart
            key={chartKey}
            data={chartData}
            margin={chartMargin}
            barCategoryGap={barCategoryGap}
            {...(resolvedBarSize == null && !dynamicBarSize ? { maxBarSize } : {})}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
              animationDuration={useVerticalBarAnimation ? 0 : undefined}
            />
            <XAxis
              type="category"
              dataKey={labelKey}
              height={xAxisHeight}
              tick={{ fontSize: xAxisFontSize, fill: "var(--text-secondary)" }}
              angle={xAxisAngle}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
              tickMargin={4}
            />
            <YAxis
              width={yAxisWidth}
              tickMargin={yAxisTickMargin}
              type="number"
              animationDuration={useVerticalBarAnimation ? 0 : undefined}
              {...valueAxisProps}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: "var(--accent-light)" }}
              position={{ x: 16, y: 16 }}
            />
            <Bar
              dataKey={barDataKey}
              fill={color}
              radius={[3, 3, 0, 0]}
              isAnimationActive={!useVerticalBarAnimation && animateBars}
              shape={useVerticalBarAnimation ? verticalBarShape : undefined}
              {...(resolvedBarSize != null
                ? { barSize: resolvedBarSize }
                : { maxBarSize })}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
