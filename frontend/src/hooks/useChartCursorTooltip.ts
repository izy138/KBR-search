import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { chartTooltipCursorPosition } from "../utils/chartStyles";

/**
 * Tracks cursor position for fixed chart tooltips and clears or re-syncs on scroll
 * when the pointer is no longer over the chart (avoids stuck tooltips while scrolling).
 */
export function useChartCursorTooltip(chartRootRef: RefObject<HTMLElement | null>) {
  const [cursorTooltipPos, setCursorTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const syncTooltipWithPointer = useCallback(() => {
    const chartRoot = chartRootRef.current;
    const last = lastPointerRef.current;
    if (chartRoot == null || last == null) {
      setCursorTooltipPos(null);
      return;
    }
    const underPointer = document.elementFromPoint(last.x, last.y);
    if (!(underPointer instanceof Node) || !chartRoot.contains(underPointer)) {
      setCursorTooltipPos(null);
      return;
    }
    setCursorTooltipPos(chartTooltipCursorPosition(last.x, last.y));
  }, [chartRootRef]);

  const handleChartMouseMove = useCallback((event: MouseEvent<HTMLElement>) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setCursorTooltipPos(chartTooltipCursorPosition(event.clientX, event.clientY));
  }, []);

  const handleChartMouseLeave = useCallback(() => {
    lastPointerRef.current = null;
    setCursorTooltipPos(null);
  }, []);

  useEffect(() => {
    if (cursorTooltipPos == null) return;

    const onScrollOrResize = (): void => {
      syncTooltipWithPointer();
    };

    document.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [cursorTooltipPos, syncTooltipWithPointer]);

  return {
    cursorTooltipPos,
    handleChartMouseMove,
    handleChartMouseLeave,
  };
}
