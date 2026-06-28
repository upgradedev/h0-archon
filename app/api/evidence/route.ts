import { NextResponse } from "next/server";
import { dbMode, getLatestReport, persistReport } from "@/lib/db";
import { buildJudgeEvidence } from "@/lib/insights";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  let report = await getLatestReport();
  if (!report) {
    report = await runPipeline(undefined, dbMode());
    await persistReport(report);
  }
  return NextResponse.json(buildJudgeEvidence(report));
}
