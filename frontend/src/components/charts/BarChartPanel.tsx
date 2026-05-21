import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import {
  CHART_TOOLTIP_ROUNDED_STYLE,
  CLS_CHART_CURSOR_TOOLTIP,
  CLS_RECHARTS_FOCUS_RESET,
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_WRAPPER_STYLE,
} from "../../utils/chartStyles";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
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

type ColoredBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number | [number, number, number, number];
  payload?: Record<string, unknown>;
  fill?: string;
};

function createColoredBarShape(
  resolveFill: (row: Record<string, unknown>) => string,
  defaultFill: string,
): (props: ColoredBarShapeProps) => JSX.Element {
  return function ColoredBarShape(props: ColoredBarShapeProps) {
    const { x = 0, y = 0, width = 0, height = 0, radius = 0, payload, fill } = props;
    const barFill = payload ? resolveFill(payload) : fill ?? defaultFill;
    return (
      <Rectangle x={x} y={y} width={width} height={height} radius={radius} fill={barFill} />
    );
  };
}

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
  /** When set, each row's fill comes from this field (falls back to `color`). */
  barFillKey?: string;
  height?: number;
  /** Extra space reserved for angled category labels on horizontal charts */
  xAxisHeight?: number;
  /** Nudge category tick labels vertically (negative moves up). */
  xAxisTickDy?: number;
  xAxisAngle?: number;
  xAxisFontSize?: number;
  yAxisFontSize?: number;
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
  /** Size the chart area to the remaining panel height (parent must define height) */
  fillHeight?: boolean;
  /** Fired when a bar is clicked; receives the row payload (includes label / full_label). */
  onBarClick?: (row: Record<string, unknown>) => void;
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
  barFillKey,
  xAxisHeight = 90,
  xAxisTickDy,
  xAxisAngle = -40,
  xAxisFontSize = 10,
  yAxisFontSize = 11,
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
  fillHeight = false,
  onBarClick,
}: BarChartPanelProps) {
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const [measuredChartHeight, setMeasuredChartHeight] = useState(0);
  useEffect(() => {
    if (!fillHeight) {
      setMeasuredChartHeight(0);
      return;
    }

    const chartBody = chartBodyRef.current;
    if (!chartBody) return;

    const updateHeight = (entries?: ResizeObserverEntry[]): void => {
      const height =
        entries?.[0]?.contentRect.height ?? chartBody.getBoundingClientRect().height;
      setMeasuredChartHeight(Math.max(Math.round(height), 0));
    };

    updateHeight();

    const observer = new ResizeObserver((entries) => updateHeight(entries));
    observer.observe(chartBody);

    return () => observer.disconnect();
  }, [fillHeight, data.length, layout]);

  const chartHeight = fillHeight ? Math.max(measuredChartHeight, 1) : height;
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
      <div className={cn(CLS_CHART_CURSOR_TOOLTIP, "z-10")} style={CHART_TOOLTIP_ROUNDED_STYLE}>
        <div className="text-text-primary font-semibold mb-1 text-[0.82rem]">{label}</div>
        <div className="text-text-secondary">{displayValue}</div>
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
    tick: { fontSize: yAxisFontSize, fill: "var(--text-secondary)" },
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

  const panelClass = cn(
    "bg-surface border border-border rounded-[--radius-lg] w-full px-4 min-h-[310px]",
    fillHeight ? "flex flex-col min-h-0 h-full overflow-visible py-0" : "py-[0.9rem]",
    panelClassName,
    CLS_RECHARTS_FOCUS_RESET,
    onBarClick && "[&_.recharts-bar-rectangle]:cursor-pointer",
  );

  const handleBarClick = (barEntry: { payload?: Record<string, unknown> }): void => {
    if (!onBarClick || !barEntry.payload) return;
    onBarClick(barEntry.payload);
  };

  const handleChartMouseDownCapture = useCallback((event: MouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Node && event.currentTarget.contains(target)) {
      event.preventDefault();
    }
  }, []);

  const coloredBarShape = useMemo(() => {
    if (!barFillKey) return undefined;
    return createColoredBarShape((row) => {
      const custom = row[barFillKey];
      if (typeof custom === "string" && custom.trim()) return custom;
      return color;
    }, color);
  }, [barFillKey, color, chartData]);

  const useVerticalBarAnimation = barAnimation === "vertical";
  const verticalBarShape = useVerticalBarShapeRenderer(
    tooltipLabelKey ?? labelKey,
    barAnimationSnapKey,
  );
  const barShape = useVerticalBarAnimation ? verticalBarShape : coloredBarShape;

  if (useVerticalBarAnimation) {
    syncVerticalBarSnapKey(barAnimationSnapKey);
  }

  const chartPlot = isVertical ? (
    <BarChart
      accessibilityLayer={false}
      data={chartData}
      layout="vertical"
      margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
    >
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
        contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
        wrapperStyle={RECHARTS_TOOLTIP_WRAPPER_STYLE}
        cursor={{ fill: "var(--accent-light)" }}
      />
      <Bar
        dataKey={barDataKey}
        fill={color}
        radius={[0, 3, 3, 0]}
        maxBarSize={24}
        shape={barShape}
        onClick={onBarClick ? handleBarClick : undefined}
      />
    </BarChart>
  ) : (
    <BarChart
      accessibilityLayer={false}
      key={chartKey}
      data={chartData}
      margin={chartMargin}
      barCategoryGap={barCategoryGap}
      {...(resolvedBarSize == null && !dynamicBarSize ? { maxBarSize } : {})}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
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
        {...(xAxisTickDy != null ? { dy: xAxisTickDy } : {})}
      />
      <YAxis
        width={yAxisWidth}
        tickMargin={yAxisTickMargin}
        type="number"
        {...valueAxisProps}
      />
      <Tooltip
        content={renderTooltip}
        contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
        wrapperStyle={RECHARTS_TOOLTIP_WRAPPER_STYLE}
        cursor={{ fill: "var(--accent-light)" }}
      />
      <Bar
        dataKey={barDataKey}
        fill={color}
        radius={[3, 3, 0, 0]}
        isAnimationActive={!useVerticalBarAnimation && animateBars}
        shape={barShape}
        onClick={onBarClick ? handleBarClick : undefined}
        {...(resolvedBarSize != null ? { barSize: resolvedBarSize } : { maxBarSize })}
      />
    </BarChart>
  );

  return (
    <div className={panelClass}>
      {headerCenter != null || headerEnd != null ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 mb-[0.65rem]">
          <div className="text-text-primary text-[0.9rem] font-semibold mb-0 whitespace-nowrap">{title}</div>
          {headerCenter != null ? (
            <div className="justify-self-center min-w-0 w-full">{headerCenter}</div>
          ) : null}
          {headerEnd != null ? <div className="justify-self-end">{headerEnd}</div> : null}
        </div>
      ) : (
        <div className="text-text-primary text-[0.9rem] font-semibold mb-[0.65rem]">{title}</div>
      )}
      <div
        ref={chartBodyRef}
        className={cn(
          fillHeight && "relative min-h-0 w-full flex-1 overflow-visible",
        )}
        onMouseDownCapture={handleChartMouseDownCapture}
      >
        {(!fillHeight || chartHeight > 0) &&
          (fillHeight ? (
            <div className="absolute inset-0 min-h-0 overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                {chartPlot}
              </ResponsiveContainer>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              {chartPlot}
            </ResponsiveContainer>
          ))}
      </div>
    </div>
  );
}
