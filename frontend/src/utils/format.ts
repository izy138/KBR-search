/**
 * Shared dollar-formatting utilities.
 *
 * Two canonical formats cover every use case in the codebase:
 *   - formatDollarsCompact — charts, KPI cards, map tooltips
 *   - formatDollarsFull    — data tables, detail views
 */

/**
 * Compact dollar format for charts and KPI cards.
 * Examples: $1.5B, $2.3M, $4.5K, $500
 */
export function formatDollarsCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}

/**
 * Full dollar format for data display using locale-aware separators.
 * Returns "—" for null, undefined, or NaN.
 * Example: $1,234,567
 */
export function formatDollarsFull(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
