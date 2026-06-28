import { NextResponse } from "next/server";
import { persistActivity } from "@/lib/db";
import { buildFinanceAnswer } from "@/lib/qa";
import { getOrCreateLatestReport } from "@/lib/report-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getOrCreateLatestReport();
  return NextResponse.json(
    buildFinanceAnswer(report, "What is our true payroll cost versus the bank statement?")
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const report = await getOrCreateLatestReport();
  const answer = buildFinanceAnswer(report, body.question || "");
  const activity = await persistActivity({
    kind: "ask",
    summary: `Answered finance question: ${answer.question}`,
    details: {
      question: answer.question,
      answer: answer.answer,
      source_ids: answer.sources.map((source) => source.id),
      report_generated_at: report.generated_at,
      report_event_id: report.event.event_id,
    },
  });

  return NextResponse.json({
    ...answer,
    activity_id: activity.activity_id,
    persisted_via: activity.db_mode,
  });
}
