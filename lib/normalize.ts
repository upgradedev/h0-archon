// Report/activity normalization — shared by the data-access layer and the
// presentation layer so the legacy-field migration logic lives in exactly
// one place.

import type { AnalysisReport, AuditActivity, AuditActivityKind } from "./types";

// Resolve the human-facing analysis-engine label, mapping the legacy
// `narrator_model` field and any "fallback*" value onto the canonical engine.
export function resolveAnalysisEngine(report: AnalysisReport): string {
  const legacy = (report as AnalysisReport & { narrator_model?: string }).narrator_model;
  const engine = report.analysis_engine || legacy || "deterministic-finance-engine";
  return engine.toLowerCase().startsWith("fallback") ? "deterministic-finance-engine" : engine;
}

// Strip the legacy `narrator_model` key and pin a canonical analysis_engine.
export function normalizeReport(report: AnalysisReport): AnalysisReport {
  const { narrator_model: _legacy, ...clean } = report as AnalysisReport & { narrator_model?: string };
  void _legacy;
  return { ...clean, analysis_engine: resolveAnalysisEngine(report) };
}

export function normalizeActivity(activity: AuditActivity): AuditActivity {
  return { ...activity, summary: activity.summary.slice(0, 240) };
}

export function activityId(kind: AuditActivityKind, createdAt: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${kind}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${suffix}`;
}
