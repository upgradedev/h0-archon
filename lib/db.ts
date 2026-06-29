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

// Fire-and-forget index into the OpenSearch read-model after a successful write.
// Guarded by the endpoint env so the (server-only, heavy) client module is never
// loaded — and no floating promise is created — when search is not configured.
// Errors are swallowed: the read-model must never break the write path.
function indexAfterWrite(run: (mod: typeof import("./opensearch")) => Promise<void>): void {
  if (!process.env.OPENSEARCH_ENDPOINT) return;
  void import("./opensearch")
    .then((mod) => run(mod))
    .catch(() => {
      // best-effort
    });
}

export async function persistReport(report: AnalysisReport): Promise<void> {
  await getStore().persistReport(report);
  indexAfterWrite((mod) => mod.indexReportBestEffort(report));
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
  const saved = await store.persistActivity(record);
  indexAfterWrite((mod) => mod.indexActivityBestEffort(saved));
  return saved;
}

export async function getActivityHistory(limit = 10): Promise<AuditActivity[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  return getStore().getActivityHistory(safeLimit);
}
