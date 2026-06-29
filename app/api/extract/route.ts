// Live document-extraction API for the /extract demo page.
//
// POST { file: "<one of the sample filenames>" }
//   -> reads the committed sample PDF, runs REAL AWS Bedrock vision extraction
//      (lib/extraction), scores the result vs bundled ground truth, returns it.
//
// Degrades gracefully (never 500s the demo):
//   - if BEDROCK_* / AWS creds are absent  -> mode "cached" + friendly reason
//   - if the fs read or extraction fails   -> mode "cached" + the error reason
// The cached payload is the bundled ground-truth document (app/extract/data.ts),
// so the page renders a meaningful result with zero AWS and zero fs dependency.

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { extractDocument } from "@/lib/extraction";
import {
  ACCURACY_TABLE,
  GROUND_TRUTH,
  SAMPLE_CASE,
  scoreDocument,
} from "@/app/extract/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-west-2";

// Whitelist: only the curated sample filenames are accepted (no path traversal).
const ALLOWED = new Set(SAMPLE_CASE.docs.map((d) => d.file));

function bedrockConfigured(): boolean {
  // A live attempt only makes sense with creds in the environment. Vercel sets
  // AWS_ACCESS_KEY_ID/SECRET; an instance role would also work but we keep the
  // fast-path honest and explicit for the demo.
  return Boolean(
    process.env.BEDROCK_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

function cachedResponse(file: string, reason: string) {
  const document = GROUND_TRUTH[file];
  const score = scoreDocument(document, file);
  return NextResponse.json({
    mode: "cached" as const,
    reason,
    modelId: MODEL_ID,
    region: REGION,
    file,
    company: SAMPLE_CASE.company,
    period: SAMPLE_CASE.period,
    document,
    confidence: null,
    flags: [],
    tokens: null,
    score,
    accuracyTable: ACCURACY_TABLE,
  });
}

export async function POST(req: Request) {
  let file = "";
  try {
    const body = (await req.json()) as { file?: string };
    file = String(body.file ?? "");
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!ALLOWED.has(file)) {
    return NextResponse.json(
      { error: "unknown sample file", allowed: [...ALLOWED] },
      { status: 400 }
    );
  }

  // Fast path: no credentials -> bundled cached example (no AWS, no fs).
  if (!bedrockConfigured()) {
    return cachedResponse(
      file,
      "BEDROCK_REGION / AWS credentials not configured — showing the cached ground-truth example. " +
        "Set BEDROCK_REGION=eu-west-1, BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6 and AWS creds to run live."
    );
  }

  // Live path. fs read can throw on a deploy that didn't trace the corpus;
  // extractDocument itself never throws (returns confidence 0 + flags).
  let bytes: Uint8Array;
  try {
    // String-literal subfolder so Next's output file tracing can scope the read
    // (an imported constant here makes it trace the whole project). `file` is
    // already whitelisted above against SAMPLE_CASE.docs.
    const abs = path.join(process.cwd(), "eval/corpus/sample/case-0001/docs", file);
    bytes = new Uint8Array(fs.readFileSync(abs));
  } catch (err) {
    return cachedResponse(
      file,
      `sample PDF not available on this deployment (${(err as NodeJS.ErrnoException)?.code ?? "read error"}) — showing cached example.`
    );
  }

  try {
    const outcome = await extractDocument(
      { bytes, mime: "application/pdf", sourceFilename: file },
      { modelId: MODEL_ID }
    );
    // extractDocument swallows Bedrock errors into flags; surface them as cached
    // fallback so the user sees a clear configure-to-run state, not garbage.
    const failed =
      outcome.confidence === 0 &&
      outcome.flags.some((f) => /bedrock call failed|not valid JSON/i.test(f));
    if (failed) {
      return cachedResponse(
        file,
        `live extraction did not return usable data (${outcome.flags.join("; ")}) — showing cached example.`
      );
    }

    const score = scoreDocument(outcome.document, file);
    return NextResponse.json({
      mode: "live" as const,
      reason: null,
      modelId: MODEL_ID,
      region: REGION,
      file,
      company: SAMPLE_CASE.company,
      period: SAMPLE_CASE.period,
      document: outcome.document,
      confidence: outcome.confidence,
      flags: outcome.flags,
      tokens: { input: outcome.inputTokens, output: outcome.outputTokens },
      score,
      accuracyTable: ACCURACY_TABLE,
    });
  } catch (err) {
    return cachedResponse(
      file,
      `live extraction failed (${(err as Error)?.name ?? "Error"}) — showing cached example.`
    );
  }
}
