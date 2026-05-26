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
  if (v >= 10) return 10;
  if (v >= 5) return 5;
  if (v >= 2) return 2;
  return 1;
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

export type IcProjectsHybridAxisScale = {
  linearMax: number;
  tickValues: number[];
};

/** Round up IC project count axis max for linear Projects by Institute chart. */
export function roundUpIcProjectsLinearAxisMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }
  if (maxValue < 25) {
    return niceAxisCeil(maxValue, 0);
  }
  if (maxValue < 50) return 50;
  if (maxValue < 75) return 75;
  if (maxValue <= 100) return 100;

  const step = maxValue < 10_000 ? 100 : 1_000;
  return Math.ceil(maxValue / step) * step;
}

const IC_HYBRID_LOG_LOW_TICKS = [10, 50, 100, 500, 1000] as const;
const IC_HYBRID_LINEAR_MIN_DEFAULT = 20_000;

/** Round up IC hybrid log-axis max from the highest bar value. */
export function computeIcLogAxisMax(dataMax: number): number {
  if (!Number.isFinite(dataMax) || dataMax <= 0) {
    return 1000;
  }
  if (dataMax <= 100) {
    return roundUpIcProjectsLinearAxisMax(dataMax);
  }
  if (dataMax < 1000) {
    return niceAxisCeil(dataMax, 0);
  }
  if (dataMax < 10_000) {
    return Math.ceil(dataMax / 1000) * 1000;
  }
  if (dataMax < IC_HYBRID_LINEAR_MIN_DEFAULT) {
    return Math.ceil(dataMax / 5000) * 5000;
  }
  return roundUpIcProjectsLinearAxisMax(dataMax);
}

/** Tick step for the hybrid IC chart linear segment above hybridLinearMin. */
function chooseIcHybridLinearUpperStep(linearSpan: number): number {
  if (linearSpan <= 0) {
    return 1_000;
  }
  if (linearSpan <= 2_500) {
    return 1_000;
  }
  if (linearSpan <= 6_000) {
    return 2_000;
  }
  if (linearSpan <= 15_000) {
    return 5_000;
  }
  if (linearSpan <= 50_000) {
    return 10_000;
  }
  return niceStepForMagnitude(linearSpan / 3);
}

function computeIcLogMiddleTick(linearMax: number): number | null {
  if (linearMax <= 2000) {
    return null;
  }
  const half = linearMax / 2;
  if (half <= 1000 || half >= linearMax) {
    return null;
  }
  return half;
}

/**
 * Optimal y-axis ticks for the IC hybrid chart log region (≤ hybridLinearMin).
 * Standard ticks below 1k; above 1k uses top, midpoint (half), and 1k.
 */
export function buildIcLogRegionTicks(linearMax: number): number[] {
  const ticks = new Set<number>();

  for (const tick of IC_HYBRID_LOG_LOW_TICKS) {
    if (tick <= linearMax) {
      ticks.add(tick);
    }
  }

  if (linearMax > 1000) {
    const middle = computeIcLogMiddleTick(linearMax);
    if (middle != null) {
      ticks.add(middle);
    }
    ticks.add(linearMax);
  } else if (!ticks.has(linearMax)) {
    ticks.add(linearMax);
  }

  return [...ticks].sort((a, b) => a - b);
}

function buildIcHybridTickValues(linearMax: number, hybridLinearMin: number): number[] {
  if (linearMax <= hybridLinearMin) {
    return buildIcLogRegionTicks(linearMax);
  }

  const ticks = new Set<number>(buildIcLogRegionTicks(hybridLinearMin));
  ticks.add(hybridLinearMin);

  const linearSpan = linearMax - hybridLinearMin;
  const step = chooseIcHybridLinearUpperStep(linearSpan);
  let value = Math.ceil(hybridLinearMin / step) * step;
  if (value <= hybridLinearMin) {
    value += step;
  }
  while (value < linearMax) {
    ticks.add(value);
    value += step;
  }
  ticks.add(linearMax);
  return [...ticks].sort((a, b) => a - b);
}

function buildIntegerEvenTickValues(axisMax: number, tickCount: number): number[] {
  const intervals = Math.max(1, tickCount - 1);
  const ticks: number[] = [];
  for (let index = 0; index <= intervals; index += 1) {
    ticks.push(Math.round((axisMax * index) / intervals));
  }
  const unique: number[] = [];
  for (const tick of ticks) {
    if (!unique.includes(tick)) {
      unique.push(tick);
    }
  }
  if (unique[unique.length - 1] !== axisMax) {
    unique.push(axisMax);
  }
  return unique;
}

const IC_PROJECTS_LINEAR_MAX_TICKS = 6;

/** Smallest nice step that keeps tick count at or below IC_PROJECTS_LINEAR_MAX_TICKS. */
function roundUpIcProjectsLinearTickStep(minStep: number): number {
  if (!Number.isFinite(minStep) || minStep <= 0) {
    return 1;
  }
  const magnitude = niceStepForMagnitude(minStep);
  return Math.ceil(minStep / magnitude) * magnitude;
}

function buildIcProjectsLinearTickValues(axisMax: number): number[] {
  if (axisMax <= 100) {
    return buildIntegerEvenTickValues(axisMax, 4);
  }

  const maxIntervals = IC_PROJECTS_LINEAR_MAX_TICKS - 1;
  const step = roundUpIcProjectsLinearTickStep(axisMax / maxIntervals);
  const ticks: number[] = [0];
  for (let value = step; value < axisMax; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== axisMax) {
    ticks.push(axisMax);
  }
  return ticks;
}

/** Axis ceiling for Projects by Institute linear scale from current bar values. */
export function buildIcProjectsLinearAxisMax(values: number[]): number {
  const positives = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positives.length === 0) {
    return 1;
  }
  return roundUpIcProjectsLinearAxisMax(Math.max(...positives));
}

/** Axis max and y-axis ticks for Projects by Institute linear scale. */
export function buildIcProjectsLinearAxisScale(values: number[]): LinearBarAxisScale {
  const axisMax = buildIcProjectsLinearAxisMax(values);
  return {
    axisMax,
    tickValues: buildIcProjectsLinearTickValues(axisMax),
  };
}

/** Round up bar chart y-axis max to a clean tick boundary from data values. */
export function buildLinearBarAxisMax(values: number[]): number {
  return buildLinearBarAxisScale(values).axisMax;
}

export type LinearBarAxisScale = {
  axisMax: number;
  tickValues: number[];
};

/** Evenly spaced ticks from 0 through axisMax (inclusive). */
function buildEvenLinearBarTickValues(axisMax: number, tickCount: number): number[] {
  const intervals = Math.max(1, tickCount - 1);
  const ticks: number[] = [];
  for (let index = 0; index <= intervals; index += 1) {
    ticks.push((axisMax * index) / intervals);
  }
  return ticks;
}

/** Axis max and evenly spaced y-axis ticks for funding/count bar charts. */
export function buildLinearBarAxisScale(
  values: number[],
  targetTickCount = 4,
): LinearBarAxisScale {
  const positives = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positives.length === 0) {
    return { axisMax: 1, tickValues: [0, 1] };
  }

  const dataMax = Math.max(...positives);
  const axisMax = niceAxisCeil(dataMax, 0);
  const tickCount = Math.min(5, Math.max(3, targetTickCount));

  return {
    axisMax,
    tickValues: buildEvenLinearBarTickValues(axisMax, tickCount),
  };
}

/**
 * Derives hybrid log/linear axis max and tick positions from the current IC bar values.
 * Uses fallback max/ticks when the dataset matches the unfiltered full-range scale.
 */
export function buildIcProjectsHybridAxisScale(
  values: number[],
  options?: {
    hybridLinearMin?: number;
    fallbackLinearMax?: number;
    fallbackTickValues?: readonly number[];
    matchFallbackTolerance?: number;
  },
): IcProjectsHybridAxisScale {
  const hybridLinearMin = options?.hybridLinearMin ?? 20_000;
  const fallbackLinearMax = options?.fallbackLinearMax ?? 80_000;
  const fallbackTickValues = options?.fallbackTickValues ?? [];
  const matchTolerance = options?.matchFallbackTolerance ?? 0.1;

  const positives = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positives.length === 0) {
    return {
      linearMax: fallbackLinearMax,
      tickValues: fallbackTickValues.length > 0 ? [...fallbackTickValues] : [fallbackLinearMax],
    };
  }

  const dataMax = Math.max(...positives);
  const linearMax = computeIcLogAxisMax(dataMax);

  if (
    fallbackTickValues.length > 0
    && Math.abs(linearMax - fallbackLinearMax) / fallbackLinearMax <= matchTolerance
  ) {
    return { linearMax: fallbackLinearMax, tickValues: [...fallbackTickValues] };
  }

  return {
    linearMax,
    tickValues: buildIcHybridTickValues(linearMax, hybridLinearMin),
  };
}
