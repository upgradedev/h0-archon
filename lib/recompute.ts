// Per-session "what-if" recompute for uploaded documents.
//
// A public visitor can drop their OWN documents onto the agent-ledger tile. We
// MERGE the uploaded ExtractedDocument(s) with the canonical base documents and
// re-run the deterministic fusion pipeline (linkEvent -> validate -> analyze) to
// produce an updated AnalysisReport, PLUS the uploaded trade invoices to fold into
// the business-intelligence layer (sales/purchases).
//
// EPHEMERAL + SAFE: this NEVER persists. The result lives only in the caller's
// session (the recompute API route returns it; the client swaps it into the
// dashboard data-context). The shared canonical close is never mutated — uploaded
// docs are normalized onto the base company/period anchor so the recomputed close
// stays coherent, but nothing is written back.
//
// Pure + AWS-free (only the deterministic pipeline + sample data) so it is unit
// testable without Bedrock or DynamoDB.

import type { AnalysisReport, ExtractedDocument } from "./types";
import type { DashboardVM } from "./dashboard-vm";
import { analyzeFinance, extract, linkEvent, validate } from "./pipeline";

// The three payroll subtypes flow through linkEvent into the fused PayrollEvent.
const PAYROLL_TYPES: ReadonlySet<string> = new Set([
  "bank_confirmation",
  "payroll_register",
  "payslip",
]);
// The two trade subtypes carry revenue / cost-of-purchase; they never flow through
// linkEvent — they are folded into buildBusinessIntelligence as extra invoices.
const INVOICE_TYPES: ReadonlySet<string> = new Set(["sales_invoice", "purchase_invoice"]);

export interface SplitDocuments {
  payroll: ExtractedDocument[];
  invoices: ExtractedDocument[];
}

// Partition uploaded docs into the payroll family (fused) vs trade invoices (folded
// into BI). `unknown` docs are ignored — they cannot be placed in the close.
export function splitUploaded(uploaded: ExtractedDocument[]): SplitDocuments {
  return {
    payroll: uploaded.filter((d) => PAYROLL_TYPES.has(d.doc_type)),
    invoices: uploaded.filter((d) => INVOICE_TYPES.has(d.doc_type)),
  };
}

// Merge uploaded PAYROLL docs into the base document set, preserving the base
// company/period anchor so the recomputed close stays the canonical month:
//   - payslip          : add the employee (or replace by employee_id if it already
//                        exists) — this changes headcount and employer_cost_total.
//   - bank_confirmation: replace-by-type (the bank confirmation is a single total).
//   - payroll_register : replace-by-type (one register per month).
// Base docs keep their order so docs[0] (the company/period anchor) is stable.
export function mergeDocuments(
  base: ExtractedDocument[],
  uploadedPayroll: ExtractedDocument[],
): ExtractedDocument[] {
  const company = base[0]?.company ?? "Unknown";
  const period = base[0]?.period ?? "Unknown";
  const merged: ExtractedDocument[] = base.map((d) => ({ ...d }));

  for (const up of uploadedPayroll) {
    // Normalize onto the canonical anchor so the fused event stays coherent.
    const doc: ExtractedDocument = { ...up, company, period };
    if (doc.doc_type === "payslip") {
      const id = doc.employee?.employee_id;
      const idx = id
        ? merged.findIndex((d) => d.doc_type === "payslip" && d.employee?.employee_id === id)
        : -1;
      if (idx >= 0) merged[idx] = doc;
      else merged.push(doc);
    } else if (doc.doc_type === "bank_confirmation") {
      const idx = merged.findIndex((d) => d.doc_type === "bank_confirmation");
      if (idx >= 0) merged[idx] = doc;
      else merged.push(doc);
    } else if (doc.doc_type === "payroll_register") {
      const idx = merged.findIndex((d) => d.doc_type === "payroll_register");
      if (idx >= 0) merged[idx] = doc;
      else merged.push(doc);
    }
  }
  return merged;
}

export interface RecomputeResult {
  report: AnalysisReport;
  invoices: ExtractedDocument[];
}

// Merge uploaded docs with the canonical base and re-run the deterministic
// pipeline. NEVER persists. Returns the per-session report + the uploaded trade
// invoices (the caller folds those into the dashboard view-model).
export async function recomputeReport(uploaded: ExtractedDocument[]): Promise<RecomputeResult> {
  const { payroll, invoices } = splitUploaded(uploaded);
  const base = extract(); // canonical sample-payroll documents
  const merged = mergeDocuments(base, payroll);
  const event = linkEvent(merged);
  const validations = validate(event, merged);
  const { summary, model } = await analyzeFinance(event, validations);
  const report: AnalysisReport = {
    event,
    validations,
    executive_summary: summary,
    analysis_engine: model,
    generated_at: new Date().toISOString(),
    db_mode: "embedded-demo",
  };
  return { report, invoices };
}

// Which dashboard tiles changed between two view-models — used to flash only the
// affected KPI tiles / panels. Returns stable flash keys: `kpi:<id>` per KPI, plus
// "pnl" / "cash" / "payroll" for the panels.
export function diffTiles(oldVM: DashboardVM, newVM: DashboardVM): string[] {
  const keys: string[] = [];
  const moved = (a: number, b: number) => Math.abs(a - b) > 0.005;

  for (const kpi of newVM.kpis) {
    const prev = oldVM.kpis.find((k) => k.id === kpi.id);
    if (prev && moved(prev.value, kpi.value)) keys.push(`kpi:${kpi.id}`);
  }
  if (
    moved(oldVM.pnl.revenue, newVM.pnl.revenue) ||
    moved(oldVM.pnl.cogs, newVM.pnl.cogs) ||
    moved(oldVM.pnl.ebitda, newVM.pnl.ebitda) ||
    moved(oldVM.pnl.operatingExpenses, newVM.pnl.operatingExpenses)
  ) {
    keys.push("pnl");
  }
  if (
    moved(oldVM.cash.closing, newVM.cash.closing) ||
    moved(oldVM.cash.netMovement, newVM.cash.netMovement)
  ) {
    keys.push("cash");
  }
  if (
    moved(oldVM.payroll.trueEmployerCost, newVM.payroll.trueEmployerCost) ||
    moved(oldVM.payroll.bankOutflow, newVM.payroll.bankOutflow) ||
    moved(oldVM.payroll.hidden, newVM.payroll.hidden) ||
    oldVM.payroll.headcount !== newVM.payroll.headcount
  ) {
    keys.push("payroll");
  }
  return keys;
}
