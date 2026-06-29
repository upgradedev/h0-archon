// Bundled, fs-free data for the /extract live-extraction demo.
//
// Why bundled (not read from eval/corpus at runtime): Next output file tracing
// follows imports, not dynamic `fs.readFileSync` over a non-standard `eval/`
// dir, so on Vercel those reads can ENOENT. Importing this module guarantees
// the page + its graceful-degradation fallback work regardless of fs, AWS
// credentials, or the mupdf WASM module.
//
// The ground-truth values below are copied verbatim from
// eval/corpus/sample/case-0001/ground_truth.json (the same labels the eval
// harness scores against). The measured accuracy table is from
// eval/LIVE_EXTRACTION.md (real Bedrock vision, 2026-06-28).

import type { DocType, ExtractedDocument } from "@/lib/types";

export interface SampleDoc {
  file: string;
  docType: DocType;
  label: string;
  /** Human note shown in the picker. */
  hint: string;
}

export const SAMPLE_CASE = {
  caseId: "case-0001",
  company: "Kyklades Retail OE",
  period: "2026-07",
  corpusPath: "eval/corpus/sample/case-0001/docs",
  docs: [
    {
      file: "bank_confirmation_2026-07.pdf",
      docType: "bank_confirmation",
      label: "Bank mass-payment confirmation",
      hint: "One net salary total — the figure that understates true cost.",
    },
    {
      file: "payroll_register_2026-07.pdf",
      docType: "payroll_register",
      label: "Payroll register",
      hint: "Company totals incl. employer IKA — the true employer cost.",
    },
    {
      file: "payslip_EMP-001_2026-07.pdf",
      docType: "payslip",
      label: "Payslip — Eleni Manos (EMP-001)",
      hint: "A single employee's gross / IKA / tax / net breakdown.",
    },
    {
      file: "payslip_EMP-002_2026-07.pdf",
      docType: "payslip",
      label: "Payslip — Vasiliki Dimou (EMP-002)",
      hint: "A single employee's gross / IKA / tax / net breakdown.",
    },
  ] satisfies SampleDoc[],
};

function baseDoc(file: string): ExtractedDocument {
  return {
    doc_id: file.replace(/\.[^.]+$/, ""),
    doc_type: "unknown",
    company: SAMPLE_CASE.company,
    period: SAMPLE_CASE.period,
    source_filename: file,
    bank_net_total: null,
    gross_total: null,
    employer_cost_total: null,
    employer_ika_total: null,
    employee_ika_total: null,
    tax_withheld_total: null,
    register_employee_count: null,
    employee: null,
    payment_date: null,
  };
}

// Ground-truth ExtractedDocument per sample file (from ground_truth.json).
export const GROUND_TRUTH: Record<string, ExtractedDocument> = {
  "bank_confirmation_2026-07.pdf": {
    ...baseDoc("bank_confirmation_2026-07.pdf"),
    doc_type: "bank_confirmation",
    bank_net_total: 4018.44,
    payment_date: "2026-07-28",
  },
  "payroll_register_2026-07.pdf": {
    ...baseDoc("payroll_register_2026-07.pdf"),
    doc_type: "payroll_register",
    gross_total: 5420.0,
    employee_ika_total: 751.76,
    tax_withheld_total: 649.8,
    employer_ika_total: 1208.12,
    employer_cost_total: 6628.12,
    register_employee_count: 2,
    payment_date: "2026-07-28",
  },
  "payslip_EMP-001_2026-07.pdf": {
    ...baseDoc("payslip_EMP-001_2026-07.pdf"),
    doc_type: "payslip",
    employee: {
      employee_id: "EMP-001",
      name: "Eleni Manos",
      gross: 2155.0,
      employee_ika: 298.9,
      tax: 219.45,
      net: 1636.65,
      employer_ika: 480.35,
      employer_cost: 2635.35,
    },
    payment_date: "2026-07-28",
  },
  "payslip_EMP-002_2026-07.pdf": {
    ...baseDoc("payslip_EMP-002_2026-07.pdf"),
    doc_type: "payslip",
    employee: {
      employee_id: "EMP-002",
      name: "Vasiliki Dimou",
      gross: 3265.0,
      employee_ika: 452.86,
      tax: 430.35,
      net: 2381.79,
      employer_ika: 727.77,
      employer_cost: 3992.77,
    },
    payment_date: "2026-07-28",
  },
};

// Measured real-Bedrock accuracy (eval/LIVE_EXTRACTION.md, 2026-06-28).
export const ACCURACY_TABLE = {
  model: "eu.anthropic.claude-sonnet-4-6",
  region: "eu-west-1",
  date: "2026-06-28",
  overallFieldAccuracy: 0.967,
  overallClassification: 1.0,
  rows: [
    { docType: "bank_confirmation", classification: "5/5 (100%)", fields: "5/5 (100%)" },
    { docType: "payroll_register", classification: "5/5 (100%)", fields: "25/25 (100%)" },
    { docType: "payslip", classification: "5/5 (100%)", fields: "28/30 (93.3%)" },
    { docType: "overall", classification: "15/15 (100%)", fields: "58/60 (96.7%)" },
  ],
};

// Shape returned by POST /api/extract (shared by the route and the client).
export interface ExtractApiResponse {
  mode: "live" | "cached";
  reason: string | null;
  modelId: string;
  region: string;
  file: string;
  company: string;
  period: string;
  document: ExtractedDocument;
  confidence: number | null;
  flags: string[];
  tokens: { input: number; output: number } | null;
  score: DocScore | null;
  accuracyTable: typeof ACCURACY_TABLE;
}

// ---------------------------------------------------------------------------
// Field-accuracy scoring (single document vs ground truth).
// Mirrors eval/lib/metrics.ts: numeric match within 1 cent OR 0.5% relative.
// ---------------------------------------------------------------------------
const NUM_REL_TOL = 0.005;
function numMatch(expected: number, actual: unknown): boolean {
  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  if (Math.abs(expected - actual) <= 0.01) return true;
  if (expected === 0) return Math.abs(actual) <= 0.01;
  return Math.abs(expected - actual) / Math.abs(expected) <= NUM_REL_TOL;
}

const DOC_NUMERIC_FIELDS: Record<string, (keyof ExtractedDocument)[]> = {
  bank_confirmation: ["bank_net_total"],
  payroll_register: [
    "gross_total",
    "employee_ika_total",
    "tax_withheld_total",
    "employer_ika_total",
    "employer_cost_total",
  ],
  payslip: [],
};
const EMPLOYEE_FIELDS = ["gross", "employee_ika", "tax", "net", "employer_ika", "employer_cost"] as const;

export interface FieldComparison {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

export interface DocScore {
  classificationExpected: DocType;
  classificationActual: DocType;
  classificationMatch: boolean;
  fields: FieldComparison[];
  total: number;
  correct: number;
  accuracy: number;
}

export function scoreDocument(actual: ExtractedDocument, file: string): DocScore | null {
  const truth = GROUND_TRUTH[file];
  if (!truth) return null;

  const fields: FieldComparison[] = [];
  const push = (field: string, exp: number | string | null, act: number | string | null) => {
    let match: boolean;
    if (typeof exp === "number") match = numMatch(exp, act as unknown);
    else match = exp === act;
    fields.push({ field, expected: exp, actual: act, match });
  };

  for (const f of DOC_NUMERIC_FIELDS[truth.doc_type] ?? []) {
    const exp = truth[f];
    if (exp == null) continue;
    push(f, exp as number, (actual[f] as number) ?? null);
  }
  if (truth.doc_type === "payslip" && truth.employee) {
    for (const f of EMPLOYEE_FIELDS) {
      push(`employee.${f}`, truth.employee[f], actual.employee?.[f] ?? null);
    }
  }
  if (truth.payment_date != null) {
    push("payment_date", truth.payment_date, actual.payment_date ?? null);
  }

  const correct = fields.filter((c) => c.match).length;
  return {
    classificationExpected: truth.doc_type,
    classificationActual: actual.doc_type,
    classificationMatch: actual.doc_type === truth.doc_type,
    fields,
    total: fields.length,
    correct,
    accuracy: fields.length ? correct / fields.length : 1,
  };
}
