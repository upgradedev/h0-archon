// Live document-extraction API for the /extract drag-and-drop UPLOAD path.
//
// POST multipart/form-data { file: <PDF | PNG | JPEG> }
//   -> validates content-type + size (BEFORE any Bedrock call),
//   -> enforces a GLOBAL 10-uploads/day cap (atomic DynamoDB counter),
//   -> runs the SAME live AWS Bedrock vision extraction the sample path uses,
//   -> classifies the doc type and returns the structured fields.
//
// EPHEMERAL: an uploaded document is extracted for DISPLAY ONLY. It is never
// written into the shared canonical monthly close (no persistReport) — so a
// public visitor's document can never move the demo's reported numbers.
//
// PUBLIC-DEMO SCOPE: live uploads are globally capped at 10/day to bound AWS
// Bedrock spend; the curated samples (/api/extract) are always available. The
// cap is a single atomic counter in DynamoDB, TTL'd to ~2 days. See lib/upload.ts
// and docs/demo/README.md.

import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/extraction";
import { getStore } from "@/lib/store";
import {
  MAX_FILES_PER_REQUEST,
  RATE_LIMIT_MESSAGE,
  reserveUploadSlot,
  UPLOAD_DAILY_LIMIT,
  validateUploadFile,
} from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-west-2";

function bedrockConfigured(): boolean {
  return Boolean(
    process.env.BEDROCK_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

export async function POST(req: Request) {
  // 1. Parse the multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a single 'file' field." },
      { status: 400 }
    );
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Upload one file per request (max ${MAX_FILES_PER_REQUEST}).` },
      { status: 400 }
    );
  }
  const file = files[0];

  // 2. Validate type + size BEFORE spending any Bedrock inference.
  const check = validateUploadFile({ contentType: file.type, size: file.size });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  // 3. If Bedrock is not configured, do NOT burn a rate-limit slot — there is no
  //    cached ground truth for an arbitrary upload, so we just say so.
  if (!bedrockConfigured()) {
    return NextResponse.json(
      {
        mode: "unavailable" as const,
        error:
          "Live upload extraction is not configured on this deployment. " +
          "Try the curated sample documents — they always work.",
      },
      { status: 503 }
    );
  }

  // 4. Atomically reserve a daily slot AFTER validation, BEFORE extraction.
  let rate;
  try {
    rate = await reserveUploadSlot(getStore());
  } catch {
    // A counter failure must not hard-fail the demo: degrade to allow.
    rate = { allowed: true, count: 0, limit: UPLOAD_DAILY_LIMIT };
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE, limit: rate.limit },
      { status: 429 }
    );
  }

  // 5. Run the SAME live Bedrock vision extraction as the sample path. The
  //    source filename is metadata only — never sent to the model.
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const outcome = await extractDocument(
      { bytes, mime: check.mime, sourceFilename: file.name || "upload" },
      { modelId: MODEL_ID }
    );
    return NextResponse.json({
      mode: "live" as const,
      modelId: MODEL_ID,
      region: REGION,
      filename: file.name || "upload",
      docType: outcome.document.doc_type,
      document: outcome.document,
      confidence: outcome.confidence,
      flags: outcome.flags,
      tokens: { input: outcome.inputTokens, output: outcome.outputTokens },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Extraction failed (${(err as Error)?.name ?? "Error"}). Please try again.` },
      { status: 502 }
    );
  }
}
