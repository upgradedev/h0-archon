import { NextResponse } from "next/server";
import { dbMode, getLatestReport, persistReport } from "@/lib/db";
import { buildFinanceAnswer } from "@/lib/qa";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  let report = await getLatestReport();
  if (!report) {
    report = await runPipeline(undefined, dbMode());
    await persistReport(report);
  }
  return NextResponse.json(buildFinanceAnswer(report, body.question || ""));
}
