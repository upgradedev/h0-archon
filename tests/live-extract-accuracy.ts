// BOUNDED, COST-AWARE live accuracy probe for the Bedrock extraction layer.
//
// NOT a CI test (filename has no `.test.` and it is not in the `npm test` list).
// It hits real AWS Bedrock, so it requires credentials and costs a few cents.
//
//   npx tsx tests/live-extract-accuracy.ts [corpusDir] [maxPerType]
//
// It samples a SMALL, doc-type-stratified set from the eval corpus, runs real
// multimodal extraction (rasterize PDF -> image -> Converse), matches each
// result to ground truth by source_filename, and reports:
//   - doc-type classification accuracy (content-only; filenames never seen)
//   - field-level extraction accuracy per doc type (abs tolerance 0.01)
//   - measured Bedrock token cost.

import fs from "node:fs";
import path from "node:path";
import { extractDocument } from "../lib/extraction/extract";
import { DEFAULT_MODEL_ID, DEFAULT_REGION } from "../lib/extraction/bedrock";
import type { DocType, ExtractedDocument } from "../lib/types";

const CORPUS = process.argv[2] || "eval/corpus/sample";
const MAX_PER_TYPE = Number(process.argv[3] || 5);
const TOL = 0.01;

// Bedrock Sonnet-class pricing (USD per 1M tokens), approximate.
const PRICE_IN = 3.0 / 1_000_000;
const PRICE_OUT = 15.0 / 1_000_000;

interface GtDoc {
  source_filename: string;
  doc_type: DocType;
  fields: Record<string, number>;
  employee?: Record<string, number | string> | null;
}

function loadGtDocs(corpusDir: string): { caseDir: string; doc: GtDoc }[] {
  const abs = path.resolve(corpusDir);
  const out: { caseDir: string; doc: GtDoc }[] = [];
  for (const entry of fs.readdirSync(abs).sort()) {
    const caseDir = path.join(abs, entry);
    const gtPath = path.join(caseDir, "ground_truth.json");
    if (!fs.existsSync(gtPath)) continue;
    const gt = JSON.parse(fs.readFileSync(gtPath, "utf-8"));
    for (const d of gt.extracted.documents) {
      const { source_filename, doc_type, employee, ...rest } = d;
      const fields: Record<string, number> = {};
      for (const k of Object.keys(rest)) if (typeof rest[k] === "number") fields[k] = rest[k];
      out.push({ caseDir, doc: { source_filename, doc_type, fields, employee } });
    }
  }
  return out;
}

function stratify(all: { caseDir: string; doc: GtDoc }[]) {
  const buckets: Record<string, { caseDir: string; doc: GtDoc }[]> = {};
  for (const x of all) (buckets[x.doc.doc_type] ??= []).push(x);
  const picked: { caseDir: string; doc: GtDoc }[] = [];
  for (const t of ["bank_confirmation", "payroll_register", "payslip"]) {
    picked.push(...(buckets[t] ?? []).slice(0, MAX_PER_TYPE));
  }
  return picked;
}

const FIELDS_BY_TYPE: Record<string, string[]> = {
  bank_confirmation: ["bank_net_total"],
  payroll_register: [
    "gross_total",
    "employee_ika_total",
    "tax_withheld_total",
    "employer_ika_total",
    "employer_cost_total",
  ],
  payslip: ["gross", "employee_ika", "tax", "net", "employer_ika", "employer_cost"],
};

function close(a: unknown, b: unknown): boolean {
  if (typeof a !== "number" || typeof b !== "number") return false;
  return Math.abs(a - b) <= TOL;
}

function predictedField(d: ExtractedDocument, type: string, f: string): unknown {
  if (type === "payslip") return d.employee ? (d.employee as unknown as Record<string, unknown>)[f] : undefined;
  return (d as unknown as Record<string, unknown>)[f];
}
function gtField(g: GtDoc, type: string, f: string): unknown {
  if (type === "payslip") return g.employee ? g.employee[f] : undefined;
  return g.fields[f];
}

async function main() {
  console.log(`model=${DEFAULT_MODEL_ID} region=${DEFAULT_REGION} corpus=${CORPUS} tol=${TOL}`);
  const sample = stratify(loadGtDocs(CORPUS));
  console.log(`sampled ${sample.length} docs (<=${MAX_PER_TYPE}/type)\n`);

  const perType: Record<string, { n: number; clsOk: number; fieldOk: number; fieldTot: number }> = {};
  let inTok = 0;
  let outTok = 0;

  for (const { caseDir, doc } of sample) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(caseDir, "docs", doc.source_filename)));
    const t0 = Date.now();
    const out = await extractDocument({ bytes, mime: "application/pdf", sourceFilename: doc.source_filename });
    inTok += out.inputTokens;
    outTok += out.outputTokens;

    const gtType = doc.doc_type;
    const bucket = (perType[gtType] ??= { n: 0, clsOk: 0, fieldOk: 0, fieldTot: 0 });
    bucket.n++;
    const clsOk = out.document.doc_type === gtType;
    if (clsOk) bucket.clsOk++;

    let fOk = 0;
    const fields = FIELDS_BY_TYPE[gtType] ?? [];
    for (const f of fields) {
      const ok = close(predictedField(out.document, gtType, f), gtField(doc, gtType, f));
      if (ok) fOk++;
    }
    bucket.fieldOk += fOk;
    bucket.fieldTot += fields.length;

    console.log(
      `${clsOk ? "✓" : "✗"} ${doc.source_filename}  gt=${gtType} pred=${out.document.doc_type}  ` +
        `fields ${fOk}/${fields.length}  ${Date.now() - t0}ms` +
        (out.flags.length ? `  [${out.flags.join("; ")}]` : "")
    );
  }

  console.log("\n=== per-doc-type ===");
  let clsOkAll = 0;
  let nAll = 0;
  let fOkAll = 0;
  let fTotAll = 0;
  for (const [t, b] of Object.entries(perType)) {
    clsOkAll += b.clsOk;
    nAll += b.n;
    fOkAll += b.fieldOk;
    fTotAll += b.fieldTot;
    console.log(
      `${t.padEnd(18)} n=${b.n}  classification ${b.clsOk}/${b.n} (${pct(b.clsOk, b.n)})  ` +
        `field ${b.fieldOk}/${b.fieldTot} (${pct(b.fieldOk, b.fieldTot)})`
    );
  }
  console.log("\n=== overall ===");
  console.log(`classification: ${clsOkAll}/${nAll} (${pct(clsOkAll, nAll)})`);
  console.log(`field-level:    ${fOkAll}/${fTotAll} (${pct(fOkAll, fTotAll)})`);

  const cost = inTok * PRICE_IN + outTok * PRICE_OUT;
  console.log(`\ntokens: in=${inTok} out=${outTok}  est cost ≈ $${cost.toFixed(4)} (@ $3/$15 per 1M)`);
}

function pct(a: number, b: number): string {
  return b === 0 ? "n/a" : `${((a / b) * 100).toFixed(1)}%`;
}

main().catch((e) => {
  console.error("live probe failed:", e);
  process.exit(1);
});
