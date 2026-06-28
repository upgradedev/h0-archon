// Mocked-Bedrock unit tests for the real multimodal extraction layer.
// A fake Converse client is injected — no AWS, no network, no WASM — so these
// run in CI. They assert (a) the request is assembled correctly, (b) canned
// responses map onto ExtractedDocument correctly per doc type, and (c) null /
// garbage / throwing responses never crash the extractor.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { ConverseCommandInput, ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { buildConverseInput, type ConverseClientLike } from "../lib/extraction/bedrock";
import { cleanJson, safeFloat, extractDocument, type ExtractInput } from "../lib/extraction/extract";

// --- fakes -----------------------------------------------------------------

function okResponse(text: string): ConverseCommandOutput {
  return {
    output: { message: { role: "assistant", content: [{ text }] } },
    usage: { inputTokens: 1234, outputTokens: 56, totalTokens: 1290 },
  } as ConverseCommandOutput;
}

// Captures the assembled ConverseCommandInput so tests can assert on the prompt.
function fakeClient(
  text: string | ((input: ConverseCommandInput) => string),
  capture?: (input: ConverseCommandInput) => void
): ConverseClientLike {
  return {
    async send(command) {
      const input = (command as { input: ConverseCommandInput }).input;
      capture?.(input);
      return okResponse(typeof text === "function" ? text(input) : text);
    },
  };
}

function throwingClient(name: string): ConverseClientLike {
  return {
    async send() {
      const e = new Error("simulated transport failure");
      e.name = name;
      throw e;
    },
  };
}

const imgInput = (sourceFilename: string): ExtractInput => ({
  bytes: new Uint8Array([1, 2, 3]),
  mime: "image/png",
  sourceFilename,
});

const PAYSLIP_JSON = JSON.stringify({
  doc_type: "payslip",
  detected_language: "el",
  company: "Nestos Packaging OE",
  period: "2026-07",
  payment_date: "2026-07-28",
  bank_net_total: null,
  gross_total: null,
  employee_ika_total: null,
  tax_withheld_total: null,
  employer_ika_total: null,
  employer_cost_total: null,
  employee: {
    employee_id: "EMP-001",
    name: "Ioannis Nikolaou",
    gross: 1100,
    employee_ika: 152.57,
    tax: 19,
    net: 928.43,
    employer_ika: 245.19,
    employer_cost: 1345.19,
  },
  text_excerpt: "ΑΠΟΔΕΙΞΗ ΠΛΗΡΩΜΗΣ",
  confidence: 0.95,
});

const REGISTER_JSON = JSON.stringify({
  doc_type: "payroll_register",
  company: "Nestos Packaging OE",
  period: "2026-07",
  payment_date: "2026-07-28",
  gross_total: 14495.0,
  employee_ika_total: 2010.45,
  tax_withheld_total: 1424.05,
  employer_ika_total: 3230.94,
  employer_cost_total: 17725.94,
  employee: null,
  text_excerpt: "ΜΙΣΘΟΔΟΤΙΚΗ ΚΑΤΑΣΤΑΣΗ",
  confidence: 0.9,
});

const BANK_JSON = JSON.stringify({
  doc_type: "bank_confirmation",
  company: "Nestos Packaging OE",
  period: "2026-07",
  payment_date: "2026-07-28",
  bank_net_total: 11060.5,
  employee: null,
  text_excerpt: "ΒΕΒΑΙΩΣΗ ΜΑΖΙΚΗΣ ΠΛΗΡΩΜΗΣ - EUROBANK",
  confidence: 0.92,
});

// --- request assembly ------------------------------------------------------

test("buildConverseInput: system prompt, image-then-text order, defaults", () => {
  const input = buildConverseInput({
    system: "SYS",
    parts: [
      { type: "image", format: "png", bytes: new Uint8Array([9]) },
      { type: "text", text: "PROMPT" },
    ],
  });
  assert.equal(input.system?.[0]?.text, "SYS");
  assert.equal(input.modelId, "us.anthropic.claude-sonnet-4-6");
  assert.equal(input.inferenceConfig?.maxTokens, 2048);
  const content = input.messages?.[0]?.content ?? [];
  assert.ok("image" in content[0], "first block is an image");
  assert.ok("text" in content[1], "second block is the text prompt");
  assert.equal((content[1] as { text: string }).text, "PROMPT");
});

test("the source filename is NEVER sent to the model (no label leakage)", async () => {
  let captured: ConverseCommandInput | undefined;
  await extractDocument(imgInput("payslip_EMP-001_2026-07.pdf"), {
    client: fakeClient(PAYSLIP_JSON, (i) => (captured = i)),
  });
  const serialized = JSON.stringify(captured);
  assert.ok(!serialized.includes("payslip_EMP-001"), "filename must not appear in the request");
  assert.ok(!serialized.includes(".pdf"), "extension must not appear in the request");
});

// --- per-doc-type mapping --------------------------------------------------

test("payslip response maps to ExtractedDocument", async () => {
  const out = await extractDocument(imgInput("a.png"), { client: fakeClient(PAYSLIP_JSON) });
  const d = out.document;
  assert.equal(d.doc_type, "payslip");
  assert.equal(d.company, "Nestos Packaging OE");
  assert.equal(d.period, "2026-07");
  assert.equal(d.payment_date, "2026-07-28");
  assert.equal(d.source_filename, "a.png");
  assert.equal(d.bank_net_total, null);
  assert.ok(d.employee);
  assert.equal(d.employee?.employee_id, "EMP-001");
  assert.equal(d.employee?.net, 928.43);
  assert.equal(d.employee?.employer_cost, 1345.19);
  assert.equal(out.confidence, 0.95);
  assert.equal(out.inputTokens, 1234);
  assert.equal(out.outputTokens, 56);
});

test("payroll_register response maps totals", async () => {
  const out = await extractDocument(imgInput("r.png"), { client: fakeClient(REGISTER_JSON) });
  const d = out.document;
  assert.equal(d.doc_type, "payroll_register");
  assert.equal(d.gross_total, 14495.0);
  assert.equal(d.employer_ika_total, 3230.94);
  assert.equal(d.employer_cost_total, 17725.94);
  assert.equal(d.employee_ika_total, 2010.45);
  assert.equal(d.tax_withheld_total, 1424.05);
  assert.equal(d.employee, null);
});

test("bank_confirmation response maps net total only", async () => {
  const out = await extractDocument(imgInput("b.png"), { client: fakeClient(BANK_JSON) });
  const d = out.document;
  assert.equal(d.doc_type, "bank_confirmation");
  assert.equal(d.bank_net_total, 11060.5);
  assert.equal(d.gross_total, null);
  assert.equal(d.employee, null);
});

// --- classifier override (content-only) ------------------------------------

test("classifier reclassifies via field shape and flags the override", async () => {
  // Model wrongly says bank_confirmation, but an employee object is present.
  const wrong = JSON.stringify({
    doc_type: "bank_confirmation",
    company: "X",
    period: "2026-07",
    employee: { employee_id: "E1", name: "N", gross: 100, employee_ika: 10, tax: 5, net: 85, employer_ika: 22, employer_cost: 122 },
    text_excerpt: "",
    confidence: 0.8,
  });
  const out = await extractDocument(imgInput("x.png"), { client: fakeClient(wrong) });
  assert.equal(out.document.doc_type, "payslip");
  assert.ok(out.flags.some((f) => f.includes("reclassified bank_confirmation -> payslip")));
});

// --- null / garbage / failure resilience -----------------------------------

test("non-JSON response never throws; returns unknown doc with confidence 0", async () => {
  const out = await extractDocument(imgInput("g.png"), {
    client: fakeClient("I cannot help with that request."),
  });
  assert.equal(out.document.doc_type, "unknown");
  assert.equal(out.confidence, 0);
  assert.ok(out.flags.some((f) => f.includes("not valid JSON")));
  // usage is still surfaced from the (parseable) transport response
  assert.equal(out.inputTokens, 1234);
});

test("a thrown Bedrock error is swallowed into a best-effort result", async () => {
  const out = await extractDocument(imgInput("t.png"), {
    client: throwingClient("ThrottlingException"),
  });
  assert.equal(out.document.doc_type, "unknown");
  assert.equal(out.document.source_filename, "t.png");
  assert.equal(out.confidence, 0);
  assert.ok(out.flags.some((f) => f.includes("ThrottlingException")));
});

test("missing payslip numeric fields default to 0 and are flagged", async () => {
  const partial = JSON.stringify({
    doc_type: "payslip",
    company: "X",
    period: "2026-07",
    employee: { employee_id: "E1", name: "N", gross: 100, employee_ika: null, tax: 5, net: 85, employer_ika: null, employer_cost: 122 },
    confidence: 0.7,
  });
  const out = await extractDocument(imgInput("p.png"), { client: fakeClient(partial) });
  assert.equal(out.document.employee?.employee_ika, 0);
  assert.equal(out.document.employee?.employer_ika, 0);
  assert.ok(out.flags.some((f) => f.includes("employee_ika")));
});

test("markdown-fenced JSON is parsed", async () => {
  const out = await extractDocument(imgInput("f.png"), {
    client: fakeClient("```json\n" + BANK_JSON + "\n```"),
  });
  assert.equal(out.document.doc_type, "bank_confirmation");
  assert.equal(out.document.bank_net_total, 11060.5);
});

test("PDF input routes through the (injected) rasterizer to image blocks", async () => {
  let captured: ConverseCommandInput | undefined;
  let rasterized = false;
  await extractDocument(
    { bytes: new Uint8Array([0]), mime: "application/pdf", sourceFilename: "doc.pdf" },
    {
      client: fakeClient(BANK_JSON, (i) => (captured = i)),
      rasterize: async () => {
        rasterized = true;
        return [new Uint8Array([1]), new Uint8Array([2])];
      },
    }
  );
  assert.ok(rasterized, "rasterizer was invoked for the PDF");
  const content = captured?.messages?.[0]?.content ?? [];
  // two rasterized page images + one text prompt
  assert.equal(content.filter((c) => "image" in c).length, 2);
  assert.ok("text" in content[content.length - 1]);
});

// --- pure helpers ----------------------------------------------------------

test("cleanJson strips fences and surrounding prose", () => {
  assert.equal(cleanJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(cleanJson('Here is the JSON: {"a":1} done'), '{"a":1}');
  assert.equal(cleanJson('{"a":1}'), '{"a":1}');
});

test("safeFloat tolerates nulls, garbage, and el/en number formats", () => {
  assert.equal(safeFloat(null), null);
  assert.equal(safeFloat(undefined), null);
  assert.equal(safeFloat(""), null);
  assert.equal(safeFloat("n/a"), null);
  assert.equal(safeFloat(42), 42);
  assert.equal(safeFloat("1234.56"), 1234.56);
  assert.equal(safeFloat("1.234,56"), 1234.56); // el
  assert.equal(safeFloat("1,234.56"), 1234.56); // en
  assert.equal(safeFloat("€ 11.060,50"), 11060.5);
});
