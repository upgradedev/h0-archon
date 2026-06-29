// Upload helpers for the public live-extraction drop zone (/extract).
//
// Two concerns, both factored into PURE, AWS-free functions so the validation
// and rate-limit DECISIONS are unit-testable without DynamoDB or Bedrock:
//   1. File validation  — content-type + size gate, run BEFORE any Bedrock call.
//   2. Daily rate limit  — a single global counter, atomically incremented in
//      DynamoDB (or in-memory in embedded mode), capped at 10 uploads/day.
//
// PUBLIC-DEMO SCOPE: live uploads are globally capped at 10/day to bound AWS
// Bedrock spend; the curated samples (the /api/extract sample path) are always
// available regardless of this cap. See docs/demo/README.md.
//
// This module is intentionally PURE (no AWS SDK / store import) so it is safe to
// import from the client drop-zone component AND unit-testable without DynamoDB.
// The daily counter is injected into reserveUploadSlot() by the server route.

// The image MIME types the vision extractor accepts (matches ExtractInput.mime
// in lib/extraction/extract.ts; declared locally to keep this module pure).
export type UploadMime = "application/pdf" | "image/png" | "image/jpeg";

// ---------------------------------------------------------------------------
// 1. File validation (pure)
// ---------------------------------------------------------------------------

// 3 MB hard ceiling — a rasterized payroll PDF / phone photo is far smaller, and
// this bounds both the Bedrock token cost and the request body we accept.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

// At most one document per request — the client POSTs each dropped file
// separately, so the endpoint never fans out multiple Bedrock calls per request.
export const MAX_FILES_PER_REQUEST = 1;

// Only document/image types the vision extractor can actually read.
export const ALLOWED_UPLOAD_MIME: ReadonlyMap<string, UploadMime> = new Map([
  ["application/pdf", "application/pdf"],
  ["image/png", "image/png"],
  ["image/jpeg", "image/jpeg"],
]);

export type UploadValidation =
  | { ok: true; mime: UploadMime }
  | { ok: false; status: number; error: string };

// Validate a single upload's declared content-type and byte size. This runs
// BEFORE any Bedrock call so a bad request never costs an inference.
export function validateUploadFile(input: {
  contentType: string | null | undefined;
  size: number;
}): UploadValidation {
  const ct = (input.contentType ?? "").split(";")[0].trim().toLowerCase();
  const mime = ALLOWED_UPLOAD_MIME.get(ct);
  if (!mime) {
    return {
      ok: false,
      status: 415,
      error: `Unsupported file type "${ct || "unknown"}". Upload a PDF, PNG or JPEG.`,
    };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, status: 400, error: "Empty file." };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
    return { ok: false, status: 413, error: `File too large — the limit is ${mb} MB.` };
  }
  return { ok: true, mime };
}

// ---------------------------------------------------------------------------
// 2. Daily rate limit
// ---------------------------------------------------------------------------

// Global ceiling on LIVE uploads per calendar day (UTC). Bounds Bedrock spend.
export const UPLOAD_DAILY_LIMIT = 10;

// TTL ~2 days so a finished day's counter item self-expires (the date-keyed sk
// already makes each day independent, so correctness does not depend on TTL).
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

// Counter sort-key for a given day, e.g. "upload#2026-06-29".
export function uploadCounterKey(date: Date = new Date()): string {
  return `upload#${date.toISOString().slice(0, 10)}`;
}

// PURE decision: is the post-increment count still within the daily cap?
// `count` is the value AFTER atomically adding this request's +1.
export function withinDailyLimit(count: number, limit: number = UPLOAD_DAILY_LIMIT): boolean {
  return count <= limit;
}

export interface RateLimitOutcome {
  allowed: boolean;
  count: number; // post-increment count for the day (may exceed limit)
  limit: number;
}

// Minimal contract reserveUploadSlot needs — satisfied by the FinanceStore
// (lib/store.ts). Declared here so this module never imports the AWS-SDK-backed
// store (keeps it client-safe + AWS-free for unit tests).
export interface DailyCounter {
  incrementDailyCounter(key: string, ttlEpochSeconds: number): Promise<number>;
}

// Atomically reserve one upload slot for today and decide if it is allowed.
// Increments first (atomic ADD), then checks — so concurrent requests cannot
// race past the cap. In embedded mode this is an in-process counter.
export async function reserveUploadSlot(
  store: DailyCounter,
  now: Date = new Date()
): Promise<RateLimitOutcome> {
  const key = uploadCounterKey(now);
  const ttlEpoch = Math.floor(now.getTime() / 1000) + COUNTER_TTL_SECONDS;
  const count = await store.incrementDailyCounter(key, ttlEpoch);
  return { allowed: withinDailyLimit(count), count, limit: UPLOAD_DAILY_LIMIT };
}

// User-facing 429 message. Phrased generically — never leaks a raw "15/10".
export const RATE_LIMIT_MESSAGE =
  `Daily demo upload limit reached (${UPLOAD_DAILY_LIMIT}/day) — try the curated samples.`;
