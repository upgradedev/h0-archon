// Shared formatting/number helpers used across the pipeline, analysis, and UI.

export const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
