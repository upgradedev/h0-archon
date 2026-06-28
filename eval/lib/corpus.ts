// Corpus loader for the evaluation keystone.
//
// A corpus is a directory of `case-XXXX/` folders, each containing:
//   - ground_truth.json  (labels + expected_event + expected_validations + naive)
//   - docs/*.pdf         (rendered artifacts a real extractor would read)
// plus a top-level manifest.json. Produced by eval/generate_corpus.py.

import fs from "node:fs";
import path from "node:path";
import type { DocType } from "../../lib/types";

export interface GtNaive {
  bank_only_payroll_cost: number;
  true_employer_cost: number;
  understatement_amount: number;
  understatement_pct_of_true: number;
  understatement_pct_of_bank: number;
  employer_ika_wedge_pct_of_bank: number;
}

export interface GroundTruth {
  case_id: string;
  company: string;
  period: string;
  payment_date: string;
  edge_cases: string[];
  document_mix: {
    bank: boolean;
    register: boolean;
    payslips_emitted: number;
    employees_true: number;
  };
  // exact shape lib/pipeline.ts::extract() consumes
  extracted: {
    company: string;
    period: string;
    payment_date: string;
    documents: any[];
  };
  expected_event: Record<string, number>;
  expected_validations: Record<"R1" | "R2" | "R3" | "R4", boolean>;
  register_totals: Record<string, number> | null;
  naive: GtNaive | null;
  classification: Record<string, DocType>;
  artifacts: Record<string, string>;
}

export interface CorpusCase {
  caseId: string;
  caseDir: string;
  gt: GroundTruth;
}

export function loadCorpus(corpusDir: string): CorpusCase[] {
  const abs = path.resolve(corpusDir);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `corpus not found: ${abs}\n` +
        `generate it first, e.g.:\n` +
        `  python eval/generate_corpus.py --n 6 --out eval/corpus/sample --seed 1 --kind sample`
    );
  }
  const cases: CorpusCase[] = [];
  for (const entry of fs.readdirSync(abs).sort()) {
    const caseDir = path.join(abs, entry);
    const gtPath = path.join(caseDir, "ground_truth.json");
    if (!fs.statSync(caseDir).isDirectory() || !fs.existsSync(gtPath)) continue;
    const gt = JSON.parse(fs.readFileSync(gtPath, "utf-8")) as GroundTruth;
    cases.push({ caseId: gt.case_id, caseDir, gt });
  }
  if (cases.length === 0) throw new Error(`no cases found under ${abs}`);
  return cases;
}
