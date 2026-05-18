import { useCallback, useLayoutEffect, useRef, useState, type MouseEventHandler } from "react";

export interface VerticalOnlyBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  radius?: number | [number, number, number, number];
  payload?: Record<string, unknown>;
  barIdKey?: string;
  animationDuration?: number;
  /** When this value changes, bars snap instantly (e.g. linear/log toggle). */
  barAnimationSnapKey?: string;
  onClick?: MouseEventHandler<SVGRectElement>;
}

const barHeightStore = new Map<string, number>();

export function clearVerticalBarHeightStore(): void {
  barHeightStore.clear();
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Bar shape that animates height only, pinned to the current scale baseline.
 * Snaps instantly when barAnimationSnapKey changes (axis scale toggle).
 */
export default function VerticalOnlyBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  radius = 0,
  payload,
  barIdKey = "full_label",
  animationDuration = 400,
  barAnimationSnapKey = "default",
  onClick,
}: VerticalOnlyBarShapeProps) {
  const barId = String(
    payload?.[barIdKey] ?? payload?.full_label ?? payload?.short_label ?? x,
  );
  const targetHeight = Math.max(0, height);
  const targetBottom = y + targetHeight;

  const seenSnapKeyRef = useRef(barAnimationSnapKey);
  const snapActive = seenSnapKeyRef.current !== barAnimationSnapKey;

  const [renderHeight, setRenderHeight] = useState(
    () => barHeightStore.get(barId) ?? targetHeight,
  );

  const displayHeight = snapActive ? targetHeight : renderHeight;
  const renderY = targetBottom - displayHeight;

  const frameRef = useRef(0);
  const targetHeightRef = useRef(targetHeight);

  useLayoutEffect(() => {
    targetHeightRef.current = targetHeight;

    if (seenSnapKeyRef.current !== barAnimationSnapKey) {
      seenSnapKeyRef.current = barAnimationSnapKey;
      setRenderHeight(targetHeight);
      barHeightStore.set(barId, targetHeight);
      return;
    }

    const fromH = barHeightStore.get(barId) ?? renderHeight;
    const toH = targetHeight;

    if (Math.abs(fromH - toH) < 0.5) {
      setRenderHeight(toH);
      barHeightStore.set(barId, toH);
      return;
    }

    setRenderHeight(fromH);

    const start = performance.now();
    const tick = (now: number) => {
      const nextH = targetHeightRef.current;
      const t = Math.min(1, (now - start) / animationDuration);
      const eased = easeOutCubic(t);
      const h = fromH + (nextH - fromH) * eased;
      setRenderHeight(h);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        barHeightStore.set(barId, nextH);
      }
    };

    tick(start);

    return () => cancelAnimationFrame(frameRef.current);
  }, [barId, targetHeight, barAnimationSnapKey, animationDuration]);

  const rx = Array.isArray(radius) ? radius[0] : radius;

  return (
    <rect
      x={x}
      y={renderY}
      width={width}
      height={Math.max(0, displayHeight)}
      fill={fill}
      rx={rx}
      ry={rx}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined, outline: "none" }}
    />
  );
}

export function useVerticalBarShapeRenderer(
  barIdKey: string,
  barAnimationSnapKey?: string,
): (props: unknown) => JSX.Element {
  return useCallback(
    (props: unknown) => (
      <VerticalOnlyBarShape
        {...(props as VerticalOnlyBarShapeProps)}
        barIdKey={barIdKey}
        barAnimationSnapKey={barAnimationSnapKey}
      />
    ),
    [barIdKey, barAnimationSnapKey],
  );
}
