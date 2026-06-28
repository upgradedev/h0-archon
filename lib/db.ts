// Data-access facade.
//
// Thin, stable API over the persistence layer (lib/store.ts). The concrete
// backend — AWS DynamoDB, Amazon Aurora PostgreSQL, or the in-process demo
// store — is selected once by environment in getStore().

import type { AnalysisReport, AuditActivity, AuditActivityKind } from "./types";
import { activityId, normalizeActivity } from "./normalize";
import { currentDbMode, getStore } from "./store";

export type DbMode = AnalysisReport["db_mode"];

export function dbMode(): DbMode {
  return currentDbMode();
}

export async function persistReport(report: AnalysisReport): Promise<void> {
  return getStore().persistReport(report);
}

export async function getLatestReport(): Promise<AnalysisReport | null> {
  return getStore().getLatestReport();
}

export async function getReportHistory(limit = 5): Promise<AnalysisReport[]> {
  const safeLimit = Math.max(1, Math.min(limit, 25));
  return getStore().getReportHistory(safeLimit);
}

export async function persistActivity(input: {
  kind: AuditActivityKind;
  summary: string;
  details: Record<string, unknown>;
  activity_id?: string;
  created_at?: string;
}): Promise<AuditActivity> {
  const store = getStore();
  const createdAt = input.created_at || new Date().toISOString();
  const record = normalizeActivity({
    activity_id: input.activity_id || activityId(input.kind, createdAt),
    kind: input.kind,
    summary: input.summary,
    details: input.details,
    created_at: createdAt,
    db_mode: store.mode,
  });
  return store.persistActivity(record);
}

export async function getActivityHistory(limit = 10): Promise<AuditActivity[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  return getStore().getActivityHistory(safeLimit);
}
