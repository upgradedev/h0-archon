// Shared formatting/number helpers used across the pipeline, analysis, and UI.

export const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// --- UI formatting helpers (consumed by the dashboard panels) ---------------
// Merged from the v0 dashboard. Locale en-IE keeps the EUR symbol leading and
// gives clean compact notation (e.g. "€96.8K") for KPI tiles and chart labels.
export function formatEUR(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits }).format(value);
}

export function formatPct(value: number, maximumFractionDigits = 1): string {
  return `${value.toFixed(maximumFractionDigits)}%`;
}
