/** Step size for rounding axis bounds to readable tick values. */
function niceStepForMagnitude(value: number): number {
  const v = Math.abs(value);
  if (v >= 1_000_000_000) return 100_000_000;
  if (v >= 100_000_000) return 25_000_000;
  if (v >= 10_000_000) return 5_000_000;
  if (v >= 1_000_000) return 250_000;
  if (v >= 100_000) return 25_000;
  if (v >= 10_000) return 10_000;
  if (v >= 1_000) return 1_000;
  if (v >= 100) return 100;
  return 10;
}

/** Round up to a clean axis maximum (e.g. 92,400 → 100,000). */
export function niceAxisCeil(value: number, headroomRatio = 0.05): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const target = value * (1 + headroomRatio);
  const step = niceStepForMagnitude(target);
  return Math.ceil(target / step) * step;
}

/** Round down to a clean axis minimum (e.g. 76,200 → 75,000). */
export function niceAxisFloor(value: number, paddingRatio = 0.05): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const target = value * (1 - paddingRatio);
  const step = niceStepForMagnitude(value);
  return Math.max(0, Math.floor(target / step) * step);
}

export type NumericAxisDomain = [number, number];

/**
 * Builds [min, max] for a value axis. When values sit in a tight band high on the
 * scale (typical for project counts ~75k–90k with a 0-based axis), zooms the min
 * so lines are not pinned to the top edge.
 */
export function buildNumericAxisDomain(
  min: number,
  max: number,
  options?: { headroomRatio?: number; floorPaddingRatio?: number; clusterThreshold?: number },
): NumericAxisDomain {
  const headroomRatio = options?.headroomRatio ?? 0.05;
  const floorPaddingRatio = options?.floorPaddingRatio ?? 0.05;
  const clusterThreshold = options?.clusterThreshold ?? 0.4;

  if (!Number.isFinite(max) || max <= 0) {
    return [0, 1];
  }

  const axisMax = niceAxisCeil(max, headroomRatio);
  const span = max - min;
  const isClusteredHigh = min > 0 && span > 0 && span / axisMax < clusterThreshold;

  if (isClusteredHigh) {
    const axisMin = niceAxisFloor(min, floorPaddingRatio);
    return axisMin >= axisMax ? [0, axisMax] : [axisMin, axisMax];
  }

  return [0, axisMax];
}
