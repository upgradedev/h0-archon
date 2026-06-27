import { NextResponse } from "next/server";
import { dbMode, persistReport } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST() {
  const report = await runPipeline(undefined, dbMode());
  await persistReport(report);
  return NextResponse.json(report);
}
