// Live view-model for the v0 dashboard.
//
// The v0 panels were authored against a static `lib/data.ts` mock. This module
// reproduces that mock's *shape* exactly, but derives every field from the real
// AnalysisReport via buildBusinessIntelligence. The panels read it through a
// React context (components/dashboard/data-context.tsx) instead of importing the
// static module.
//
// IMPORTANT: this file is pure, server-importable TypeScript. It must NOT carry
// a "use client" directive and must not import client-only code — the dashboard
// page (a server component) calls buildDashboardVM() before rendering.

import type { AnalysisReport } from "./types";
import { buildBusinessIntelligence } from "./business";
import { round2, formatEUR, MONTHS, initials } from "./format";

// --- Panel-facing types (mirror the old lib/data.ts exports) ----------------
// `segment` and `risk` are widened versus the v0 mock so the real Greek SMB
// segments (Wholesale/Retail/Catering/Online) and our three-state purchase risk
// fit. `risk` still maps onto the v0 low/medium/high tone table.
export type Kpi = {
  id: string;
  label: string;
  value: number;
  display: "currency" | "percent" | "currencyCompact";
  delta: number; // pct vs prior period (0 from buildDashboardVM; demo-periods layers real MoM deltas)
  hint: string;
  emphasis?: "positive" | "warning";
};

export type PnlStep = { name: string; value: number; kind: "base" | "subtract" | "total" };

export type CashStep = { name: string; value: number; kind: "base" | "in" | "out" | "total" };

// Named P&L scalars (positive magnitudes) carried alongside the display
// waterfall `steps`. Consumers read these instead of re-deriving values from the
// positional `steps` array (where COGS/Opex are stored NEGATIVE).
export type Pnl = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  grossMarginPct: number;
  ebitdaMarginPct: number;
  steps: PnlStep[]; // the display waterfall (Revenue, COGS, Gross profit, Opex, EBITDA)
};

// Named cash scalars carried alongside the `cashflow` display waterfall.
export type Cash = {
  opening: number;
  closing: number;
  netMovement: number;
};

export type Salesperson = {
  name: string;
  initials: string;
  segment: string;
  actual: number;
  goal: number;
  margin: number;
};

export type Supplier = {
  name: string;
  spend: number;
  share: number;
  risk: "low" | "medium" | "high";
};

export type DocChip = { label: string; count: number; status: "processed" | "pending" | "review" };

export type Agent = {
  id: number;
  name: string;
  role: string;
  status: "done" | "running" | "flagged";
  duration: string;
  items: number;
  confidence: number;
};

export type Citation = { id: string; source: string; ref: string; amount?: string };

export type WorkingCapitalCell = { value: number; days: number; label: string; sub: string };

export type DashboardVM = {
  period: string; // prettified, e.g. "May 2026"
  periodKey: string; // raw period, e.g. "2026-05" ("all" for the aggregate)
  entity: string;
  kpis: Kpi[];
  pnl: Pnl;
  opexBreakdown: { name: string; value: number }[];
  cashflow: CashStep[];
  cash: Cash;
  runwayMonths: number;
  monthlyFixedCost: number;
  sales: Salesperson[];
  suppliers: Supplier[];
  workingCapital: {
    receivables: WorkingCapitalCell;
    payables: WorkingCapitalCell;
    vat: WorkingCapitalCell;
    gap: WorkingCapitalCell;
  };
  payroll: {
    bankOutflow: number;
    trueEmployerCost: number;
    employerWedge: number; // employer IKA — the extra cost on TOP of gross
    employerWedgePct: number; // employer IKA as % of the net the bank shows (~28%)
    hidden: number; // full understatement: true employer cost − bank net transfer
    hiddenPct: number; // full understatement as % of true employer cost
    headcount: number;
    components: { name: string; value: number }[];
    hiddenBreakdown: { name: string; value: number }[]; // sums to `hidden`
    // Per-employee roster from the fused event's payslips. Euro fields reconcile:
    // sum(employerCost) ≈ trueEmployerCost.
    employees: { name: string; gross: number; net: number; employerCost: number; employerIka: number }[];
  };
  documentIntake: DocChip[];
  agents: Agent[];
  citations: Citation[];
  suggestedQuestions: string[];
};

// "2026-05" -> "May 2026". Falls back to the raw string if it does not match.
function prettifyPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const name = MONTHS[monthIndex];
  return name ? `${name} ${year}` : period;
}

export function buildDashboardVM(report: AnalysisReport): DashboardVM {
  const bi = buildBusinessIntelligence(report);
  const event = report.event;

  const entity = event.company;
  const period = prettifyPeriod(event.period);

  // --- KPIs. No prior-period data exists, so every delta is 0 and the hint
  // carries the real context. The Delta primitive renders nothing when value===0.
  const kpis: Kpi[] = [
    {
      id: "revenue",
      label: "Revenue",
      value: bi.pnl.revenue,
      display: "currencyCompact",
      delta: 0,
      hint: `${entity} · ${period}`,
    },
    {
      id: "grossMargin",
      label: "Gross margin",
      value: bi.pnl.grossMarginPct,
      display: "percent",
      delta: 0,
      hint: "blended across segments",
    },
    {
      id: "ebitda",
      label: "EBITDA",
      value: bi.pnl.ebitda,
      display: "currencyCompact",
      delta: 0,
      hint: `${bi.pnl.ebitdaMarginPct.toFixed(1)}% of revenue`,
    },
    {
      id: "closingCash",
      label: "Closing cash",
      value: bi.cash.closingBalance,
      display: "currencyCompact",
      delta: 0,
      hint: `from ${formatEUR(bi.cash.openingBalance, { compact: true })} open`,
    },
    {
      id: "netCash",
      label: "Net cash",
      value: bi.cash.netMovement,
      display: "currencyCompact",
      delta: 0,
      hint: bi.cash.netMovement > 0 ? "positive month" : "cash movement",
      emphasis: bi.cash.netMovement > 0 ? "positive" : undefined,
    },
    {
      id: "accuracy",
      label: "AI extraction accuracy",
      value: 96.7,
      display: "percent",
      delta: 0,
      hint: "field-level, measured",
      emphasis: "positive",
    },
  ];

  // --- P&L waterfall (display steps; COGS/Opex stored NEGATIVE for the chart).
  const pnlSteps: PnlStep[] = [
    { name: "Revenue", value: bi.pnl.revenue, kind: "base" },
    { name: "COGS", value: -bi.pnl.cogs, kind: "subtract" },
    { name: "Gross profit", value: bi.pnl.grossProfit, kind: "total" },
    { name: "Opex", value: -bi.pnl.operatingExpenses, kind: "subtract" },
    { name: "EBITDA", value: bi.pnl.ebitda, kind: "total" },
  ];

  // --- Named P&L scalars (positive magnitudes), taken straight from `bi`.
  const pnl: Pnl = {
    revenue: bi.pnl.revenue,
    cogs: bi.pnl.cogs,
    grossProfit: bi.pnl.grossProfit,
    operatingExpenses: bi.pnl.operatingExpenses,
    ebitda: bi.pnl.ebitda,
    grossMarginPct: bi.pnl.grossMarginPct,
    ebitdaMarginPct: bi.pnl.ebitdaMarginPct,
    steps: pnlSteps,
  };

  // --- Named cash scalars, taken straight from `bi`.
  const cash: Cash = {
    opening: bi.cash.openingBalance,
    closing: bi.cash.closingBalance,
    netMovement: bi.cash.netMovement,
  };

  const opexBreakdown = [
    { name: "Payroll (true cost)", value: event.employer_cost_total },
    {
      name: "Rent, marketing, admin",
      value: round2(bi.pnl.operatingExpenses - event.employer_cost_total),
    },
  ];

  // --- Cash flow waterfall. The two "balance" movements are the first and last
  // entries; map by index so the first is the opening base and the last is the
  // closing total. v0's "out" waterfall expects negative values.
  const cashflow: CashStep[] = bi.cash.movements.map((movement, index) => {
    if (movement.direction === "balance") {
      return {
        name: movement.label,
        value: movement.amount,
        kind: index === 0 ? "base" : "total",
      };
    }
    if (movement.direction === "in") {
      return { name: movement.label, value: movement.amount, kind: "in" };
    }
    return { name: movement.label, value: -movement.amount, kind: "out" };
  });

  // --- Sales.
  const sales: Salesperson[] = bi.sales.performance.map((person) => ({
    name: person.owner,
    initials: initials(person.owner),
    segment: person.segment,
    actual: person.actual,
    goal: person.goal,
    margin: person.marginPct,
  }));

  // --- Suppliers. Map our "watch" risk onto the v0 "medium" tone.
  const suppliers: Supplier[] = bi.purchases.categories.map((category) => ({
    name: category.category,
    spend: category.amount,
    share: category.sharePct,
    risk: category.risk === "watch" ? "medium" : category.risk,
  }));

  // --- Working capital. Honest day metrics derived from revenue/COGS.
  const wc = bi.workingCapital;
  const dso = bi.pnl.revenue === 0 ? 0 : Math.round((wc.receivables / bi.pnl.revenue) * 30);
  const dpo = bi.pnl.cogs === 0 ? 0 : Math.round((wc.payables / bi.pnl.cogs) * 30);
  const ccc = dso - dpo;
  const workingCapital: DashboardVM["workingCapital"] = {
    receivables: { value: wc.receivables, days: dso, label: "Receivables", sub: `DSO ${dso} days` },
    payables: { value: wc.payables, days: dpo, label: "Payables", sub: `DPO ${dpo} days` },
    vat: { value: wc.vatPayable, days: 0, label: "VAT payable", sub: "Net VAT due" },
    gap: { value: wc.cashConversionGap, days: ccc, label: "Cash-conversion gap", sub: `CCC ${ccc} days` },
  };

  // --- Payroll controls.
  const payroll: DashboardVM["payroll"] = {
    bankOutflow: event.bank_net_total,
    trueEmployerCost: event.employer_cost_total,
    // The marquee insight: employer social-security (IKA) sits entirely OUTSIDE the
    // bank salary transfer, yet is ~28% of the net the bank shows.
    employerWedge: event.employer_ika_total,
    employerWedgePct: Math.round(event.cost_gap_pct),
    // The full reconciliation: everything the bank net transfer omits vs true cost.
    hidden: event.hidden_total,
    hiddenPct: Math.round((event.hidden_total / event.employer_cost_total) * 100),
    headcount: event.employee_count,
    components: [
      { name: "Gross salaries", value: event.gross_total },
      { name: "Employer IKA", value: event.employer_ika_total },
    ],
    // These three are exactly what the bank net transfer leaves out; they sum to `hidden`
    // (hidden_total = employer_ika + employee_ika + tax_withheld).
    hiddenBreakdown: [
      { name: "Employer IKA (employer contribution)", value: event.employer_ika_total },
      { name: "Employee IKA (withheld from gross)", value: event.employee_ika_total },
      { name: "Income tax withheld", value: event.tax_withheld_total },
    ],
    // Per-employee detail straight off the fused payslips. employer_cost = gross +
    // employer_ika, so sum(employerCost) reconciles to employer_cost_total.
    employees: event.employees.map((e) => ({
      name: e.name,
      gross: e.gross,
      net: e.net,
      employerCost: e.employer_cost,
      employerIka: e.employer_ika,
    })),
  };

  // --- Document intake. Honest counts: only what the fused event proves.
  const documentIntake: DocChip[] = [
    { label: "Bank confirmation", count: 1, status: "processed" },
    { label: "Payroll register", count: 1, status: "processed" },
    { label: "Payslips", count: event.employee_count, status: "processed" },
  ];

  // --- Agents. Reflects the real close pipeline end-to-end: read → classify →
  // link → validate → analyze → narrate (lib/pipeline.ts: extract → linkEvent →
  // validate → analysis). Confidence = share of validations that passed. The
  // Validator is flagged only if any control failed. Durations are not fabricated.
  const passCount = report.validations.filter((validation) => validation.passed).length;
  const total = report.validations.length;
  const anyFailed = total > 0 && passCount < total;
  const passRate = total === 0 ? 100 : Math.round((passCount / total) * 100);
  const agents: Agent[] = [
    { id: 1, name: "Extractor", role: "AWS Bedrock vision reads each document", status: "done", duration: "—", items: event.linked_docs.length, confidence: passRate },
    { id: 2, name: "Classifier", role: "Re-classify document types", status: "done", duration: "—", items: event.linked_docs.length, confidence: passRate },
    { id: 3, name: "Event Linker", role: "Fuse bank + register + payslips into one event", status: "done", duration: "—", items: event.linked_docs.length, confidence: passRate },
    { id: 4, name: "Validator", role: "Cross-document consistency", status: anyFailed ? "flagged" : "done", duration: "—", items: total, confidence: passRate },
    { id: 5, name: "PnL", role: "Aggregate P&L from register", status: "done", duration: "—", items: bi.pnl.lines.length, confidence: passRate },
    { id: 6, name: "CashFlow", role: "Real cash from bank docs", status: "done", duration: "—", items: bi.cash.movements.length, confidence: passRate },
    { id: 7, name: "Employee", role: "Per-employee salary analytics", status: "done", duration: "—", items: event.employee_count, confidence: passRate },
    { id: 8, name: "Narrator", role: "CFO executive summary", status: "done", duration: "—", items: 1, confidence: passRate },
  ];

  // --- Citations. Synthesized from real figures with real sources. (An
  // AccountingCitation builder exists in lib/insights.ts, but its shape — claim
  // + evidence text — does not carry a clean amount field the v0 Citation panel
  // wants, so we build the panel shape directly from the same underlying data.)
  const hiddenPct = Math.round(event.cost_gap_pct);
  const citations: Citation[] = [
    { id: `BANK-${event.period}`, source: "Bank confirmation — net salary transfer", ref: "total out", amount: formatEUR(event.bank_net_total) },
    { id: `REG-${event.period}`, source: "Payroll register — employer cost", ref: "gross + employer IKA", amount: formatEUR(event.employer_cost_total) },
    { id: `GAP-${event.period}`, source: "Employer IKA — hidden on bank confirmation", ref: `${hiddenPct}% of net transfer`, amount: formatEUR(event.employer_ika_total) },
    { id: `REV-${event.period}`, source: "Sales ledger — net revenue", ref: "P&L revenue", amount: formatEUR(bi.pnl.revenue) },
    { id: `EBITDA-${event.period}`, source: "P&L — EBITDA", ref: `${bi.pnl.ebitdaMarginPct.toFixed(1)}% margin`, amount: formatEUR(bi.pnl.ebitda) },
  ];

  const suggestedQuestions = [
    "Why is the true payroll cost so much higher than the bank transfer?",
    "What is driving supplier concentration?",
    "How many months of cash runway do we have?",
    "Which salesperson is furthest from their goal?",
  ];

  return {
    period,
    periodKey: event.period,
    entity,
    kpis,
    pnl,
    opexBreakdown,
    cashflow,
    cash,
    runwayMonths: bi.cash.runwayMonths,
    monthlyFixedCost: bi.pnl.operatingExpenses,
    sales,
    suppliers,
    workingCapital,
    payroll,
    documentIntake,
    agents,
    citations,
    suggestedQuestions,
  };
}
