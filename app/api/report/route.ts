import { NextResponse } from "next/server";
import { buildReportResponse } from "@/lib/insights";
import { getOrCreateLatestReport } from "@/lib/report-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getOrCreateLatestReport();
  return NextResponse.json(buildReportResponse(report));
}
