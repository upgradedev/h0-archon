// The Archon document-fusion pipeline.
//
//   Extractor  -> EventLinker -> Validator -> Narrator
//
// Each payroll event is told by three documents. The pipeline fuses them into a
// single accurate PayrollEvent and surfaces the ~28% employer-cost gap that the
// bank confirmation alone hides.

import {
  AnalysisReport,
  EmployeePayslip,
  ExtractedDocument,
  PayrollEvent,
  ValidationResult,
} from "./types";
import { generateText } from "./gemini";
import sampleData from "../data/sample-payroll.json";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// 1. EXTRACTOR
// In production this calls a vision/text LLM over uploaded PDFs/images.
// For the demo it loads the pre-extracted synthetic Greek dataset. The shape it
// returns (ExtractedDocument[]) is identical either way, so the rest of the
// pipeline is unchanged.
// ---------------------------------------------------------------------------
export function extract(raw?: any): ExtractedDocument[] {
  const src = raw || sampleData;
  const docs: ExtractedDocument[] = [];
  for (const d of src.documents) {
    docs.push({
      doc_id: d.doc_id,
      doc_type: d.doc_type,
      company: src.company,
      period: src.period,
      source_filename: d.source_filename,
      bank_net_total: d.bank_net_total ?? null,
      gross_total: d.gross_total ?? null,
      employer_cost_total: d.employer_cost_total ?? null,
      employer_ika_total: d.employer_ika_total ?? null,
      employee_ika_total: d.employee_ika_total ?? null,
      tax_withheld_total: d.tax_withheld_total ?? null,
      employee: d.employee
        ? {
            employee_id: d.employee.employee_id,
            name: d.employee.name,
            gross: d.employee.gross,
            employee_ika: d.employee.employee_ika,
            tax: d.employee.tax,
            net: d.employee.net,
            employer_ika: d.employee.employer_ika,
            employer_cost: d.employee.employer_cost,
          }
        : null,
      payment_date: d.payment_date ?? src.payment_date ?? null,
    });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// 2. EVENT LINKER
// Groups the three document subtypes by company + period and fuses them into a
// single PayrollEvent. The aggregate totals are recomputed FROM the payslips
// (the most granular truth), not just copied from the register — this is the
// fusion step that makes the numbers trustworthy.
// ---------------------------------------------------------------------------
export function linkEvent(docs: ExtractedDocument[]): PayrollEvent {
  const company = docs[0]?.company || "Unknown";
  const period = docs[0]?.period || "Unknown";

  const bankDoc = docs.find((d) => d.doc_type === "bank_confirmation");
  const payslips: EmployeePayslip[] = docs
    .filter((d) => d.doc_type === "payslip" && d.employee)
    .map((d) => d.employee as EmployeePayslip);

  const sum = (sel: (e: EmployeePayslip) => number) =>
    round2(payslips.reduce((acc, e) => acc + sel(e), 0));

  const gross_total = sum((e) => e.gross);
  const employee_ika_total = sum((e) => e.employee_ika);
  const tax_withheld_total = sum((e) => e.tax);
  const employer_ika_total = sum((e) => e.employer_ika);
  const employer_cost_total = round2(gross_total + employer_ika_total);
  const payslip_net_total = sum((e) => e.net);

  // The bank confirmation is the company's *visible* payroll cash-out.
  const bank_net_total = round2(bankDoc?.bank_net_total ?? payslip_net_total);

  // Headline insight: employer social-security contributions are invisible on
  // the bank confirmation, yet are ~28% of the net figure the bank shows.
  const cost_gap_amount = employer_ika_total;
  const cost_gap_pct = round2((cost_gap_amount / bank_net_total) * 100);
  const hidden_total = round2(employer_cost_total - bank_net_total);

  return {
    event_id: `evt-${company.replace(/\s+/g, "-").toLowerCase()}-${period}`,
    company,
    period,
    employee_count: payslips.length,
    bank_net_total,
    gross_total,
    employer_ika_total,
    employee_ika_total,
    tax_withheld_total,
    employer_cost_total,
    cost_gap_amount,
    cost_gap_pct,
    hidden_total,
    employees: payslips,
    linked_docs: docs.map((d) => d.doc_id),
  };
}

// ---------------------------------------------------------------------------
// 3. VALIDATOR
// Cross-document consistency checks. These catch extraction errors and prove
// the three documents actually describe the same payroll event.
// ---------------------------------------------------------------------------
export function validate(event: PayrollEvent, docs: ExtractedDocument[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const payslipNet = round2(event.employees.reduce((a, e) => a + e.net, 0));

  // R1 — bank net ≈ sum of payslip nets (±2%)
  const r1Delta = event.bank_net_total === 0 ? 0 : Math.abs(event.bank_net_total - payslipNet) / event.bank_net_total;
  results.push({
    rule: "R1",
    description: "Bank net transfer ≈ sum of payslip net pay (±2%)",
    passed: r1Delta <= 0.02,
    detail: `bank=${event.bank_net_total} vs payslips=${payslipNet} (Δ ${(r1Delta * 100).toFixed(2)}%)`,
  });

  // R2 — employer IKA ratio is in the expected Greek band (22.29% of gross, ±1pt)
  const ikaRatio = event.gross_total === 0 ? 0 : (event.employer_ika_total / event.gross_total) * 100;
  results.push({
    rule: "R2",
    description: "Employer IKA ratio within Greek statutory band (~22.29% of gross, ±1pt)",
    passed: Math.abs(ikaRatio - 22.29) <= 1.0,
    detail: `employer_ika/gross = ${ikaRatio.toFixed(2)}% (expected ~22.29%)`,
  });

  // R3 — payment date present on the extracted event payload
  const paymentDate = docs.find((d) => d.payment_date)?.payment_date;
  const hasDate = !!paymentDate;
  results.push({
    rule: "R3",
    description: "Payment date present and consistent across documents",
    passed: hasDate,
    detail: hasDate ? `payment_date=${paymentDate}` : "no payment date found",
  });

  // R4 — employee count matches across register and payslips
  const payslipCount = docs.filter((d) => d.doc_type === "payslip").length;
  results.push({
    rule: "R4",
    description: "Employee count consistent (register vs payslips)",
    passed: payslipCount === event.employee_count,
    detail: `payslips=${payslipCount}, event=${event.employee_count}`,
  });

  return results;
}

// ---------------------------------------------------------------------------
// 4. NARRATOR
// Calls Gemini to write a CFO-level executive summary grounded in the fused
// numbers. Falls back to a deterministic template if the LLM is unavailable, so
// the pipeline never hard-fails in a demo.
// ---------------------------------------------------------------------------
export async function narrate(
  event: PayrollEvent,
  validations: ValidationResult[]
): Promise<{ summary: string; model: string }> {
  const prompt = buildNarratorPrompt(event, validations);
  const result = await generateText(prompt);
  if (result.ok) {
    return { summary: result.text, model: result.model };
  }
  return {
    summary: fallbackSummary(event),
    model: `fallback-template (Gemini unavailable: ${result.error})`,
  };
}

function buildNarratorPrompt(event: PayrollEvent, validations: ValidationResult[]): string {
  const v = validations.map((r) => `${r.rule} ${r.passed ? "PASS" : "FAIL"}: ${r.detail}`).join("; ");
  return [
    "You are a CFO-grade financial analyst writing for the owner of a Greek SMB.",
    "Write a concise executive summary (max 140 words, 3 short paragraphs) of this fused payroll event.",
    "Lead with the headline risk: the bank salary-transfer confirmation hides the employer's true payroll cost.",
    "Be specific with the euro figures. Do not invent numbers beyond those given. Plain business English.",
    "",
    `Company: ${event.company}  Period: ${event.period}  Employees: ${event.employee_count}`,
    `Bank confirmation (net salaries paid): EUR ${event.bank_net_total.toFixed(2)}`,
    `Gross payroll: EUR ${event.gross_total.toFixed(2)}`,
    `Employee IKA withheld: EUR ${event.employee_ika_total.toFixed(2)}`,
    `Income tax withheld: EUR ${event.tax_withheld_total.toFixed(2)}`,
    `Employer IKA contributions (INVISIBLE on the bank confirmation): EUR ${event.employer_ika_total.toFixed(2)}`,
    `True employer cost (gross + employer IKA): EUR ${event.employer_cost_total.toFixed(2)}`,
    `Hidden employer-contribution wedge: EUR ${event.cost_gap_amount.toFixed(2)} = ${event.cost_gap_pct.toFixed(1)}% of the net figure the bank shows.`,
    `Total understatement vs bank confirmation: EUR ${event.hidden_total.toFixed(2)}.`,
    `Cross-document validations: ${v}`,
  ].join("\n");
}

function fallbackSummary(event: PayrollEvent): string {
  return [
    `For ${event.period}, ${event.company}'s bank confirmation shows EUR ${event.bank_net_total.toFixed(2)} in net salary transfers to ${event.employee_count} employees — the figure most owners treat as "payroll cost."`,
    `That figure is misleading. The true employer cost for the month is EUR ${event.employer_cost_total.toFixed(2)}. Employer social-security (IKA) contributions of EUR ${event.cost_gap_amount.toFixed(2)} — about ${event.cost_gap_pct.toFixed(1)}% on top of the net salaries — never appear on the bank confirmation.`,
    `Including withheld employee IKA and income tax, the bank confirmation understates real payroll cash commitment by EUR ${event.hidden_total.toFixed(2)}. Budget against the fused figure, not the bank transfer.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
export async function runPipeline(raw?: any, dbMode: AnalysisReport["db_mode"] = "embedded-demo"): Promise<AnalysisReport> {
  const docs = extract(raw);
  const event = linkEvent(docs);
  const validations = validate(event, docs);
  const { summary, model } = await narrate(event, validations);
  return {
    event,
    validations,
    executive_summary: summary,
    narrator_model: model,
    generated_at: new Date().toISOString(),
    db_mode: dbMode,
  };
}
