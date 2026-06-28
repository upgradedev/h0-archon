import { NextResponse } from "next/server";
import { dbMode, persistReport } from "@/lib/db";
import { buildReportResponse } from "@/lib/insights";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST() {
  const report = await runPipeline(undefined, dbMode());
  await persistReport(report);
  return NextResponse.json(buildReportResponse(report));
}
