export function resolveFiscalYearSliderIndices(
  fyMin: string,
  fyMax: string,
  choices: readonly number[],
): [number, number] {
  if (choices.length === 0) return [0, 0];
  const last = choices.length - 1;
  if (!fyMin.trim() && !fyMax.trim()) return [0, last];

  const catalogMin = choices[0];
  const catalogMax = choices[last];
  const nMin = fyMin.trim() ? Number.parseInt(fyMin, 10) : catalogMin;
  const nMax = fyMax.trim() ? Number.parseInt(fyMax, 10) : catalogMax;

  const indexForYear = (year: number): number => {
    const exact = choices.indexOf(year);
    if (exact >= 0) return exact;
    if (year <= catalogMin) return 0;
    if (year >= catalogMax) return last;
    let nearest = 0;
    for (let i = 1; i < choices.length; i += 1) {
      if (Math.abs(choices[i] - year) < Math.abs(choices[nearest] - year)) {
        nearest = i;
      }
    }
    return nearest;
  };

  const lo = indexForYear(Number.isFinite(nMin) ? nMin : catalogMin);
  const hi = indexForYear(Number.isFinite(nMax) ? nMax : catalogMax);
  return lo <= hi ? [lo, hi] : [hi, lo];
}

export function fiscalYearIndicesToFilterValues(
  loIndex: number,
  hiIndex: number,
  choices: readonly number[],
): { fyMin: string; fyMax: string } {
  if (choices.length === 0) return { fyMin: "", fyMax: "" };
  const i0 = Math.min(loIndex, hiIndex);
  const i1 = Math.max(loIndex, hiIndex);
  if (i0 === 0 && i1 === choices.length - 1) {
    return { fyMin: "", fyMax: "" };
  }
  return { fyMin: String(choices[i0]), fyMax: String(choices[i1]) };
}

export function isFiscalYearRangeFiltered(
  fyMin: string,
  fyMax: string,
): boolean {
  return Boolean(fyMin.trim() || fyMax.trim());
}
