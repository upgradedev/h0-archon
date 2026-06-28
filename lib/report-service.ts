// Orchestration helper: compose the data-access layer (db) and the domain
// pipeline. Returns the latest persisted report, computing and persisting a
// fresh one on first run. Keeps the "run pipeline if empty" rule in one place
// instead of duplicated across every route handler and the home page.

import { dbMode, getLatestReport, persistReport } from "./db";
import { runPipeline } from "./pipeline";
import type { AnalysisReport } from "./types";

export async function getOrCreateLatestReport(): Promise<AnalysisReport> {
  const existing = await getLatestReport();
  if (existing) return existing;
  const report = await runPipeline(undefined, dbMode());
  await persistReport(report);
  return report;
}
