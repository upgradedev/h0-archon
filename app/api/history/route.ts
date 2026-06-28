import { NextResponse } from "next/server";
import { getActivityHistory, getReportHistory } from "@/lib/db";
import { buildReportResponse } from "@/lib/insights";
import { getOrCreateLatestReport } from "@/lib/report-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 5);
  const activityLimit = Number(url.searchParams.get("activity_limit") || 10);
  let reports = await getReportHistory(limit);
  if (!reports.length) {
    reports = [await getOrCreateLatestReport()];
  }
  const activity = await getActivityHistory(activityLimit);
  return NextResponse.json({
    count: reports.length,
    reports: reports.map(buildReportResponse),
    activity_count: activity.length,
    activity,
  });
}
