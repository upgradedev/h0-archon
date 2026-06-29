// Tests for the public live-extraction UPLOAD path (/api/upload).
//
//   Unit        — pure file-validation + rate-limit decision (no AWS, no DB).
//   Integration — extraction of a committed docs/demo/*.pdf through the SAME
//                 extractDocument path the route uses, with the Bedrock client
//                 AND the PDF rasterizer INJECTED (so CI needs no AWS + no WASM).
//
// We deliberately do NOT exercise a live Bedrock upload here — that costs money
// and burns the global daily quota. The route's pre-Bedrock guards (type/size,
// then rate limit) are what unit tests assert.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ConverseClientLike } from "../lib/extraction/bedrock";
import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { extractDocument } from "../lib/extraction/extract";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_DAILY_LIMIT,
  validateUploadFile,
  withinDailyLimit,
} from "../lib/upload";
import { MemoryStore } from "../lib/store";

// ---------------------------------------------------------------------------
// Unit — file validation (type + size), the gate that runs BEFORE any Bedrock call
// ---------------------------------------------------------------------------

test("validateUploadFile accepts PDF, PNG and JPEG within the size limit", () => {
  for (const [ct, mime] of [
    ["application/pdf", "application/pdf"],
    ["image/png", "image/png"],
    ["image/jpeg", "image/jpeg"],
  ] as const) {
    const r = validateUploadFile({ contentType: ct, size: 1024 });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.mime, mime);
  }
});

test("validateUploadFile tolerates a content-type with parameters", () => {
  const r = validateUploadFile({ contentType: "application/pdf; charset=binary", size: 500 });
  assert.equal(r.ok, true);
});

test("validateUploadFile rejects an unsupported type with 415", () => {
  const r = validateUploadFile({ contentType: "text/html", size: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 415);
});

test("validateUploadFile rejects a missing/empty content-type with 415", () => {
  const r = validateUploadFile({ contentType: null, size: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 415);
});

test("validateUploadFile rejects an oversized file with 413", () => {
  const r = validateUploadFile({ contentType: "application/pdf", size: MAX_UPLOAD_BYTES + 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 413);
});

test("validateUploadFile accepts a file exactly at the size limit", () => {
  const r = validateUploadFile({ contentType: "application/pdf", size: MAX_UPLOAD_BYTES });
  assert.equal(r.ok, true);
});

test("validateUploadFile rejects an empty (0-byte) file with 400", () => {
  const r = validateUploadFile({ contentType: "application/pdf", size: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 400);
});

// ---------------------------------------------------------------------------
// Unit — the rate-limit DECISION (pure helper: allow ≤10 / reject >10)
// ---------------------------------------------------------------------------

test("withinDailyLimit allows the 1st through the 10th upload and rejects the 11th", () => {
  assert.equal(withinDailyLimit(1), true);
  assert.equal(withinDailyLimit(UPLOAD_DAILY_LIMIT), true); // 10th — still allowed
  assert.equal(withinDailyLimit(UPLOAD_DAILY_LIMIT + 1), false); // 11th — rejected
  assert.equal(withinDailyLimit(50), false);
});

test("MemoryStore.incrementDailyCounter is monotonic and per-key independent", async () => {
  const store = new MemoryStore();
  const ttl = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(await store.incrementDailyCounter("upload#2026-06-29", ttl), 1);
  assert.equal(await store.incrementDailyCounter("upload#2026-06-29", ttl), 2);
  assert.equal(await store.incrementDailyCounter("upload#2026-06-29", ttl), 3);
  // A different day's key is a fresh counter.
  assert.equal(await store.incrementDailyCounter("upload#2026-06-30", ttl), 1);
});

test("incrementDailyCounter + withinDailyLimit together cap the day at 10", async () => {
  const store = new MemoryStore();
  const ttl = Math.floor(Date.now() / 1000) + 3600;
  const decisions: boolean[] = [];
  for (let i = 0; i < 12; i++) {
    const count = await store.incrementDailyCounter("upload#2026-06-29", ttl);
    decisions.push(withinDailyLimit(count));
  }
  // first 10 allowed, 11th and 12th rejected
  assert.deepEqual(decisions.slice(0, 10), Array(10).fill(true));
  assert.deepEqual(decisions.slice(10), [false, false]);
});

// ---------------------------------------------------------------------------
// Integration — a committed docs/demo file through the extraction path.
// Bedrock client + rasterizer are INJECTED: no AWS, no mupdf WASM, deterministic.
// ---------------------------------------------------------------------------

const DEMO_DIR = path.join(process.cwd(), "docs", "demo");

function okResponse(text: string): ConverseCommandOutput {
  return {
    output: { message: { role: "assistant", content: [{ text }] } },
    usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  } as ConverseCommandOutput;
}

function fakeClient(json: string): ConverseClientLike {
  return { async send() { return okResponse(json); } };
}

// rasterizer stub — proves the upload path reads the committed PDF without ever
// loading the mupdf WASM module.
const fakeRasterize = async () => [new Uint8Array([1, 2, 3])];

test("docs/demo payslip extracts + classifies through the injected path (no AWS, no WASM)", async () => {
  const file = "payslip_emp001_202601.pdf";
  const bytes = new Uint8Array(fs.readFileSync(path.join(DEMO_DIR, file)));
  assert.ok(bytes.byteLength > 0, "committed demo PDF is readable and non-empty");

  const canned = JSON.stringify({
    doc_type: "payslip",
    company: "ARCHON DEMO IKE",
    period: "2026-01",
    payment_date: "2026-01-28",
    employee: {
      employee_id: "EMP-001",
      name: "Demo Employee",
      gross: 2000,
      employee_ika: 277,
      tax: 200,
      net: 1523,
      employer_ika: 446,
      employer_cost: 2446,
    },
    text_excerpt: "ΑΠΟΔΕΙΞΗ ΠΛΗΡΩΜΗΣ",
    confidence: 0.95,
  });

  const out = await extractDocument(
    { bytes, mime: "application/pdf", sourceFilename: file },
    { client: fakeClient(canned), rasterize: fakeRasterize }
  );

  assert.equal(out.document.doc_type, "payslip");
  assert.equal(out.document.employee?.employee_id, "EMP-001");
  assert.equal(out.document.employee?.net, 1523);
  assert.equal(out.document.employee?.employer_cost, 2446);
  assert.equal(out.document.source_filename, file);
});

test("docs/demo invoice extracts + classifies through the injected path", async () => {
  const file = "aws_invoice_202601.pdf";
  const bytes = new Uint8Array(fs.readFileSync(path.join(DEMO_DIR, file)));
  assert.ok(bytes.byteLength > 0);

  const canned = JSON.stringify({
    doc_type: "purchase_invoice",
    company: "ARCHON DEMO IKE",
    period: "2026-01",
    invoice_number: "AWS-202601-0001",
    invoice_date: "2026-01-31",
    counterparty: "Amazon Web Services EMEA",
    currency: "EUR",
    net_amount: 412.5,
    vat_amount: 99.0,
    vat_rate: 24,
    gross_amount: 511.5,
    line_items: [{ description: "Cloud compute", quantity: 1, unit_price: 412.5, amount: 412.5 }],
    employee: null,
    text_excerpt: "PURCHASE INVOICE — Supplier",
    confidence: 0.9,
  });

  const out = await extractDocument(
    { bytes, mime: "application/pdf", sourceFilename: file },
    { client: fakeClient(canned), rasterize: fakeRasterize }
  );

  assert.equal(out.document.doc_type, "purchase_invoice");
  assert.equal(out.document.counterparty, "Amazon Web Services EMEA");
  assert.equal(out.document.net_amount, 412.5);
  assert.equal(out.document.gross_amount, 511.5);
  // payroll fields stay null — invoices never carry them
  assert.equal(out.document.employee, null);
});
