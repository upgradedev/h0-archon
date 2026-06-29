import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { runValidationScenario, type TamperMode } from "@/lib/tamper";

export const dynamic = "force-dynamic";

// Verification-gating demonstration.
//
// Returns a clean-vs-tampered validation A/B: the deterministic cross-document
// validator run over the correctly-fused event (all checks pass) and over the
// same event with ONE field deliberately corrupted to simulate an AI mis-read
// (a check flips to FAILED). DB-free on purpose — this is a fixed demonstration
// and must work even when DynamoDB is unavailable, so it builds the report via
// the deterministic pipeline rather than the persisted store.
export async function GET(request: Request) {
  const modeParam = new URL(request.url).searchParams.get("mode");
  const mode: TamperMode = modeParam === "ika-misread" ? "ika-misread" : "bank-misread";

  const report = await runPipeline();
  const scenario = runValidationScenario(report, mode);
  return NextResponse.json(scenario);
}
