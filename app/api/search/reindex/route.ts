import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getOrCreateLatestReport } from "@/lib/report-service";
import { osConfigured, reindexAll } from "@/lib/opensearch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/search/reindex — backfill the OpenSearch read-model from the store.
// Idempotent (docs carry stable ids → upsert). Best-effort: returns a clear JSON
// error rather than crashing if OpenSearch is down or unconfigured. DB-free-safe:
// works under the in-process store (falls back to the canonical close).
export async function POST() {
  if (!osConfigured()) {
    return NextResponse.json(
      { indexed: 0, error: "Search is not configured (OPENSEARCH_ENDPOINT missing)." },
      { status: 503 },
    );
  }

  try {
    const store = getStore();
    let reports = await store.getReportHistory(1000);
    if (reports.length === 0) {
      // Empty/embedded store — still make the canonical close searchable.
      reports = [await getOrCreateLatestReport()];
    }
    const activities = await store.getActivityHistory(1000);
    const indexed = await reindexAll(reports, activities);
    return NextResponse.json({ indexed, reports: reports.length, activities: activities.length });
  } catch (err) {
    const e = err as { message?: string; meta?: { statusCode?: number; body?: unknown } };
    const message = e?.message ?? "reindex failed";
    const statusCode = e?.meta?.statusCode;
    const body = e?.meta?.body;
    const detail = typeof body === "string" ? body.slice(0, 600) : body;
    return NextResponse.json({ indexed: 0, error: message, statusCode, detail }, { status: 502 });
  }
}
