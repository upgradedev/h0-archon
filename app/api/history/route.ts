import { NextResponse } from "next/server";
import { dbMode, getReportHistory, persistReport } from "@/lib/db";
import { buildReportResponse } from "@/lib/insights";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 5);
  let reports = await getReportHistory(limit);
  if (!reports.length) {
    const report = await runPipeline(undefined, dbMode());
    await persistReport(report);
    reports = [report];
  }
  return NextResponse.json({ count: reports.length, reports: reports.map(buildReportResponse) });
}
