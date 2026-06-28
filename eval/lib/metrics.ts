// Metric definitions for the evaluation keystone.
//
// All metrics compare an extractor's output (or the fused result) against the
// free ground-truth labels. They are pure functions so they are unit-testable.
//
//   1. classification accuracy  — doc_type vs truth
//   2. field accuracy           — extracted numbers/dates vs truth
//   3. fusion accuracy          — key figures + R1-R4 outcomes vs truth
//   4. naive floor              — bank-only understatement recovered (the value-add)

import { linkEvent, validate } from "../../lib/pipeline";
import type { ExtractedDocument } from "../../lib/types";
import type { GroundTruth } from "./corpus";

// A number "matches" if within 1 cent absolute OR within relTol relative.
export const NUM_REL_TOL = 0.005; // 0.5%
export function numMatch(expected: number, actual: number, relTol = NUM_REL_TOL): boolean {
  if (!Number.isFinite(actual)) return false;
  if (Math.abs(expected - actual) <= 0.01) return true;
  if (expected === 0) return Math.abs(actual) <= 0.01;
  return Math.abs(expected - actual) / Math.abs(expected) <= relTol;
}

// ---------------------------------------------------------------------------
// 1. Document-type classification accuracy
// ---------------------------------------------------------------------------
export interface ClassificationScore {
  total: number;
  correct: number;
  accuracy: number;
  errors: Array<{ source: string; expected: string; actual: string }>;
}

export function scoreClassification(
  docs: ExtractedDocument[],
  gt: GroundTruth
): ClassificationScore {
  const bySource = new Map(docs.map((d) => [d.source_filename, d]));
  const errors: ClassificationScore["errors"] = [];
  let correct = 0;
  let total = 0;
  for (const labelDoc of gt.extracted.documents) {
    total += 1;
    const got = bySource.get(labelDoc.source_filename);
    const expected = labelDoc.doc_type as string;
    const actual = (got?.doc_type as string) ?? "MISSING";
    if (actual === expected) correct += 1;
    else errors.push({ source: labelDoc.source_filename, expected, actual });
  }
  return { total, correct, accuracy: total ? correct / total : 1, errors };
}

// ---------------------------------------------------------------------------
// 2. Field-level extraction accuracy
// ---------------------------------------------------------------------------
const DOC_NUMERIC_FIELDS: Record<string, string[]> = {
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
const EMPLOYEE_FIELDS = ["gross", "employee_ika", "tax", "net", "employer_ika", "employer_cost"];

export interface FieldScore {
  total: number;
  correct: number;
  accuracy: number;
  mismatches: Array<{ source: string; field: string; expected: any; actual: any }>;
}

export function scoreFields(docs: ExtractedDocument[], gt: GroundTruth): FieldScore {
  const bySource = new Map(docs.map((d) => [d.source_filename, d]));
  const mismatches: FieldScore["mismatches"] = [];
  let total = 0;
  let correct = 0;

  const check = (source: string, field: string, expected: any, actual: any) => {
    total += 1;
    let ok: boolean;
    if (typeof expected === "number") ok = typeof actual === "number" && numMatch(expected, actual);
    else ok = expected === actual;
    if (ok) correct += 1;
    else mismatches.push({ source, field, expected, actual });
  };

  for (const labelDoc of gt.extracted.documents) {
    const got = bySource.get(labelDoc.source_filename) as any;
    const source = labelDoc.source_filename;
    const numericFields = DOC_NUMERIC_FIELDS[labelDoc.doc_type] ?? [];
    for (const f of numericFields) {
      if (labelDoc[f] == null) continue;
      check(source, f, labelDoc[f], got?.[f]);
    }
    if (labelDoc.doc_type === "payslip" && labelDoc.employee) {
      for (const f of EMPLOYEE_FIELDS) {
        check(source, `employee.${f}`, labelDoc.employee[f], got?.employee?.[f]);
      }
    }
    if (labelDoc.payment_date != null) {
      check(source, "payment_date", labelDoc.payment_date, got?.payment_date ?? null);
    }
  }
  return { total, correct, accuracy: total ? correct / total : 1, mismatches };
}

// ---------------------------------------------------------------------------
// 3. End-to-end fusion accuracy (the figures that matter + the four rules)
// ---------------------------------------------------------------------------
export const KEY_FIGURES = [
  "employer_cost_total",
  "hidden_total",
  "cost_gap_pct",
  "gross_total",
  "employer_ika_total",
  "bank_net_total",
  "employee_count",
] as const;

export interface FusionScore {
  figures: Record<string, { expected: number; actual: number; match: boolean }>;
  figuresCorrect: number;
  figuresTotal: number;
  validations: Record<string, { expected: boolean; actual: boolean; match: boolean }>;
  validationsCorrect: number;
  validationsTotal: number;
  // a generalization divergence = perfect inputs but pipeline disagrees with
  // DOMAIN truth (recorded per rule so we can categorize bug vs brittleness).
  validationDivergences: string[];
}

export function scoreFusion(docs: ExtractedDocument[], gt: GroundTruth): FusionScore {
  const event = linkEvent(docs) as any;
  const validations = validate(event, docs);

  const figures: FusionScore["figures"] = {};
  let figuresCorrect = 0;
  for (const f of KEY_FIGURES) {
    const expected = gt.expected_event[f];
    const actual = event[f];
    const match = f === "employee_count" ? expected === actual : numMatch(expected, actual);
    figures[f] = { expected, actual, match };
    if (match) figuresCorrect += 1;
  }

  const vals: FusionScore["validations"] = {};
  const divergences: string[] = [];
  let validationsCorrect = 0;
  for (const r of ["R1", "R2", "R3", "R4"] as const) {
    const expected = gt.expected_validations[r];
    const actual = validations.find((v) => v.rule === r)?.passed ?? false;
    const match = expected === actual;
    vals[r] = { expected, actual, match };
    if (match) validationsCorrect += 1;
    else divergences.push(r);
  }

  return {
    figures,
    figuresCorrect,
    figuresTotal: KEY_FIGURES.length,
    validations: vals,
    validationsCorrect,
    validationsTotal: 4,
    validationDivergences: divergences,
  };
}

// ---------------------------------------------------------------------------
// 4. Naive-bookkeeping FLOOR — the wrong number a bank-only view produces.
// ---------------------------------------------------------------------------
export interface NaiveFloor {
  cases: number;
  total_bank_only: number;
  total_true_cost: number;
  total_understatement: number;
  mean_understatement_pct_of_true: number;
  mean_understatement_pct_of_bank: number;
  mean_employer_ika_wedge_pct_of_bank: number;
  max_understatement_pct_of_bank: number;
}

export function naiveFloor(gts: GroundTruth[]): NaiveFloor {
  const withBank = gts.filter((g) => g.naive);
  const n = withBank.length;
  let bank = 0;
  let trueCost = 0;
  let under = 0;
  let sumPctTrue = 0;
  let sumPctBank = 0;
  let sumWedge = 0;
  let maxPctBank = 0;
  for (const g of withBank) {
    const nv = g.naive!;
    bank += nv.bank_only_payroll_cost;
    trueCost += nv.true_employer_cost;
    under += nv.understatement_amount;
    sumPctTrue += nv.understatement_pct_of_true;
    sumPctBank += nv.understatement_pct_of_bank;
    sumWedge += nv.employer_ika_wedge_pct_of_bank;
    maxPctBank = Math.max(maxPctBank, nv.understatement_pct_of_bank);
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    cases: n,
    total_bank_only: r2(bank),
    total_true_cost: r2(trueCost),
    total_understatement: r2(under),
    mean_understatement_pct_of_true: n ? r2(sumPctTrue / n) : 0,
    mean_understatement_pct_of_bank: n ? r2(sumPctBank / n) : 0,
    mean_employer_ika_wedge_pct_of_bank: n ? r2(sumWedge / n) : 0,
    max_understatement_pct_of_bank: r2(maxPctBank),
  };
}
