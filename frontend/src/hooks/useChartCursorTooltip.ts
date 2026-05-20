import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { chartTooltipCursorPosition, getScrollableAncestors } from "../utils/chartStyles";

function isPointerOverChartRoot(
  chartRoot: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const rect = chartRoot.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return false;
  }
  const underPointer = document.elementFromPoint(clientX, clientY);
  return underPointer instanceof Node && chartRoot.contains(underPointer);
}

/**
 * Tracks cursor position for chart tooltips and dismisses them on scroll when the
 * pointer is no longer over the chart (main content scroll, wheel, resize).
 */
export function useChartCursorTooltip(chartRootRef: RefObject<HTMLElement | null>) {
  const [cursorTooltipPos, setCursorTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [chartHoverActive, setChartHoverActive] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const dismissTooltip = useCallback(() => {
    setChartHoverActive(false);
    setCursorTooltipPos(null);
  }, []);

  const syncTooltipWithPointer = useCallback(() => {
    const chartRoot = chartRootRef.current;
    const last = lastPointerRef.current;
    if (chartRoot == null || last == null) {
      dismissTooltip();
      return;
    }
    if (!isPointerOverChartRoot(chartRoot, last.x, last.y)) {
      dismissTooltip();
      return;
    }
    setChartHoverActive(true);
    setCursorTooltipPos(chartTooltipCursorPosition(last.x, last.y));
  }, [chartRootRef, dismissTooltip]);

  const handleChartMouseMove = useCallback((event: MouseEvent<HTMLElement>) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setChartHoverActive(true);
    setCursorTooltipPos(chartTooltipCursorPosition(event.clientX, event.clientY));
  }, []);

  const handleChartMouseLeave = useCallback(() => {
    lastPointerRef.current = null;
    dismissTooltip();
  }, [dismissTooltip]);

  useEffect(() => {
    if (!chartHoverActive && lastPointerRef.current == null) return;

    const chartRoot = chartRootRef.current;
    if (chartRoot == null) return;

    const onScrollOrResize = (): void => {
      syncTooltipWithPointer();
    };

    const scrollTargets = getScrollableAncestors(chartRoot);
    for (const target of scrollTargets) {
      target.addEventListener("scroll", onScrollOrResize, { passive: true });
    }
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("wheel", onScrollOrResize, { passive: true });

    return () => {
      for (const target of scrollTargets) {
        target.removeEventListener("scroll", onScrollOrResize);
      }
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("wheel", onScrollOrResize);
    };
  }, [chartHoverActive, chartRootRef, syncTooltipWithPointer]);

  return {
    chartHoverActive,
    cursorTooltipPos,
    handleChartMouseMove,
    handleChartMouseLeave,
  };
}
