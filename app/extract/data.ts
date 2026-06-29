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
    {
      file: "sales_invoice_2026-07.pdf",
      docType: "sales_invoice",
      label: "Sales invoice — revenue",
      hint: "An invoice issued to a customer — line items, net, VAT, gross.",
    },
    {
      file: "purchase_invoice_2026-07.pdf",
      docType: "purchase_invoice",
      label: "Purchase invoice — supplier cost",
      hint: "An invoice received from a supplier — line items, net, VAT, gross.",
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
    invoice_number: null,
    invoice_date: null,
    counterparty: null,
    currency: null,
    net_amount: null,
    vat_amount: null,
    vat_rate: null,
    gross_amount: null,
    line_items: null,
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
  "sales_invoice_2026-07.pdf": {
    ...baseDoc("sales_invoice_2026-07.pdf"),
    doc_type: "sales_invoice",
    invoice_number: "SI-202607-0001",
    invoice_date: "2026-07-15",
    counterparty: "Nautilus Stores IKE",
    currency: "EUR",
    net_amount: 9394.0,
    vat_amount: 1221.22,
    vat_rate: 13.0,
    gross_amount: 10615.22,
    line_items: [
      { description: "Monthly distribution service", quantity: 22, unit_price: 273.0, amount: 6006.0 },
      { description: "Wholesale order — dry goods", quantity: 14, unit_price: 132.0, amount: 1848.0 },
      { description: "Monthly distribution service", quantity: 20, unit_price: 77.0, amount: 1540.0 },
    ],
  },
  "purchase_invoice_2026-07.pdf": {
    ...baseDoc("purchase_invoice_2026-07.pdf"),
    doc_type: "purchase_invoice",
    invoice_number: "PI-202607-0002",
    invoice_date: "2026-07-15",
    counterparty: "Attica Growers Coop",
    currency: "EUR",
    net_amount: 18814.5,
    vat_amount: 2445.89,
    vat_rate: 13.0,
    gross_amount: 21260.39,
    line_items: [
      { description: "Spare components", quantity: 3, unit_price: 683.0, amount: 2049.0 },
      { description: "Cleaning consumables", quantity: 27, unit_price: 566.5, amount: 15295.5 },
      { description: "Dairy supplies", quantity: 4, unit_price: 367.5, amount: 1470.0 },
    ],
  },
};

// Measured real-Bedrock accuracy (eval/LIVE_EXTRACTION.md, 2026-06-28).
export const ACCURACY_TABLE = {
  model: "eu.anthropic.claude-sonnet-4-6",
  region: "eu-west-1",
  date: "2026-06-28",
  // Payroll-family figures are MEASURED (real Bedrock run, 2026-06-28). The
  // trade-document types are newly added; their live accuracy is not yet
  // measured, so they are shown as pending rather than fabricated.
  overallFieldAccuracy: 0.967, // payroll family only
  overallClassification: 1.0, // payroll family only
  note: "Payroll-family rows are measured; sales/purchase invoices are newly added and pending a live eu-west-1 round-trip.",
  rows: [
    { docType: "bank_confirmation", classification: "5/5 (100%)", fields: "5/5 (100%)" },
    { docType: "payroll_register", classification: "5/5 (100%)", fields: "25/25 (100%)" },
    { docType: "payslip", classification: "5/5 (100%)", fields: "28/30 (93.3%)" },
    { docType: "payroll overall", classification: "15/15 (100%)", fields: "58/60 (96.7%)" },
    { docType: "sales_invoice", classification: "pending live verification", fields: "pending live verification" },
    { docType: "purchase_invoice", classification: "pending live verification", fields: "pending live verification" },
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
  sales_invoice: ["net_amount", "vat_amount", "gross_amount"],
  purchase_invoice: ["net_amount", "vat_amount", "gross_amount"],
};
// String/date fields scored for the trade-document family.
const INVOICE_STRING_FIELDS: (keyof ExtractedDocument)[] = [
  "invoice_number",
  "invoice_date",
  "counterparty",
];
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
  if (truth.doc_type === "sales_invoice" || truth.doc_type === "purchase_invoice") {
    for (const f of INVOICE_STRING_FIELDS) {
      const exp = truth[f];
      if (exp == null) continue;
      push(f, exp as string, (actual[f] as string) ?? null);
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
