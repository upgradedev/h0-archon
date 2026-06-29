// Multi-period demo data for the dashboard (January–May 2026).
//
// The real pipeline produces a single canonical close (2026-05). For a richer
// demo we synthesize four earlier months by uniformly scaling the canonical
// view-model: every euro figure is multiplied by a per-month factor while every
// ratio (margins, attainment, days, headcount, accuracy) is left untouched —
// uniform scaling preserves all ratios. May (factor 1.0) is the canonical VM,
// byte-for-byte. We also derive an "All periods" aggregate that correctly
// distinguishes flows (summed) from point-in-time balances (first/last).
//
// IMPORTANT: this file is pure, server-importable TypeScript. It must NOT carry
// a "use client" directive and must not import client-only code — the dashboard
// page (a server component) calls buildPeriodData() before rendering.

import type { AnalysisReport } from "./types";
import { round2 } from "./format";
import { buildDashboardVM, type DashboardVM } from "./dashboard-vm";

export const PERIODS = [
  { key: "2026-01", label: "Jan 2026", short: "Jan", factor: 0.82 },
  { key: "2026-02", label: "Feb 2026", short: "Feb", factor: 0.87 },
  { key: "2026-03", label: "Mar 2026", short: "Mar", factor: 0.91 },
  { key: "2026-04", label: "Apr 2026", short: "Apr", factor: 0.96 },
  { key: "2026-05", label: "May 2026", short: "May", factor: 1.0 },
] as const;

export type TrendPoint = {
  period: string;
  revenue: number;
  ebitda: number;
  closingCash: number;
  payrollGap: number;
};

export interface PeriodData {
  periods: { key: string; label: string; short: string }[];
  defaultPeriod: string;
  vmByPeriod: Record<string, DashboardVM>;
  aggregate: DashboardVM;
  trends: TrendPoint[];
}

// Deep clone a VM so scaling/aggregation never mutates the canonical instance.
// JSON round-trip is safe here: every field is a plain number/string/array/object.
function clone(vm: DashboardVM): DashboardVM {
  return JSON.parse(JSON.stringify(vm)) as DashboardVM;
}

const kpiValue = (vm: DashboardVM, id: string): number =>
  vm.kpis.find((kpi) => kpi.id === id)?.value ?? 0;

// Produce a scaled copy of the canonical VM for an earlier month. Every euro
// figure is multiplied by `factor` and rounded to 2 decimals; every ratio,
// count, and day-metric is left unchanged.
function scaleVM(base: DashboardVM, key: string, label: string, factor: number): DashboardVM {
  const vm = clone(base);
  const s = (n: number) => round2(n * factor);

  vm.period = label;
  vm.periodKey = key;

  // KPIs: scale the currency tiles; leave the percent tiles (gross margin,
  // accuracy) untouched. delta is already 0. The canonical (May) hints embed
  // May-specific context (e.g. closing cash "from €38.4K open"), which is stale
  // for a scaled month — replace every currency tile's hint with the neutral,
  // period-correct label so nothing misleading shows.
  vm.kpis = vm.kpis.map((kpi) => {
    if (kpi.display === "percent") return kpi;
    return { ...kpi, value: s(kpi.value), hint: label };
  });

  // P&L: scale the display steps AND the named euro scalars; the percentage
  // scalars (gross/EBITDA margin) are ratios → invariant under uniform scaling.
  vm.pnl.steps = vm.pnl.steps.map((step) => ({ ...step, value: s(step.value) }));
  vm.pnl.revenue = s(vm.pnl.revenue);
  vm.pnl.cogs = s(vm.pnl.cogs);
  vm.pnl.grossProfit = s(vm.pnl.grossProfit);
  vm.pnl.operatingExpenses = s(vm.pnl.operatingExpenses);
  vm.pnl.ebitda = s(vm.pnl.ebitda);

  vm.opexBreakdown = vm.opexBreakdown.map((o) => ({ ...o, value: s(o.value) }));
  vm.cashflow = vm.cashflow.map((step) => ({ ...step, value: s(step.value) }));

  // Cash named scalars scale uniformly (closing − opening = netMovement holds).
  vm.cash.opening = s(vm.cash.opening);
  vm.cash.closing = s(vm.cash.closing);
  vm.cash.netMovement = s(vm.cash.netMovement);

  // runwayMonths is a ratio of two scaled numbers → invariant; leave it.
  vm.monthlyFixedCost = s(vm.monthlyFixedCost);

  vm.sales = vm.sales.map((p) => ({ ...p, actual: s(p.actual), goal: s(p.goal) }));
  vm.suppliers = vm.suppliers.map((sup) => ({ ...sup, spend: s(sup.spend) }));

  const wc = vm.workingCapital;
  wc.receivables = { ...wc.receivables, value: s(wc.receivables.value) };
  wc.payables = { ...wc.payables, value: s(wc.payables.value) };
  wc.vat = { ...wc.vat, value: s(wc.vat.value) };
  wc.gap = { ...wc.gap, value: s(wc.gap.value) };

  const p = vm.payroll;
  p.bankOutflow = s(p.bankOutflow);
  p.trueEmployerCost = s(p.trueEmployerCost);
  p.employerWedge = s(p.employerWedge);
  p.hidden = s(p.hidden);
  p.components = p.components.map((c) => ({ ...c, value: s(c.value) }));
  p.hiddenBreakdown = p.hiddenBreakdown.map((c) => ({ ...c, value: s(c.value) }));

  // documentIntake counts, agents, citations, suggestedQuestions: unchanged.
  return vm;
}

// Aggregate all five months into an "All periods" VM. Folds the per-period
// (already-rounded) VM values so the aggregate equals the sum of the tabs by
// construction. The key correctness rule: FLOWS sum (revenue, cogs, ebitda,
// collections, payroll cost), BALANCES are point-in-time (cash open = first,
// cash close = last, receivables/payables/vat/headcount/working capital = last).
function aggregateVMs(vms: DashboardVM[]): DashboardVM {
  const first = vms[0];
  const last = vms[vms.length - 1];
  const vm = clone(last); // start from the latest period for structure + point-in-time balances

  // --- P&L: every euro line is a flow → sum the named scalars across months,
  // then rebuild the display steps + margins from the sums (same construction as
  // buildDashboardVM). Equivalent to summing the steps positionally, but keeps
  // scalars, steps, and KPIs consistent by construction.
  const sumPnl = (pick: (p: DashboardVM["pnl"]) => number): number =>
    round2(vms.reduce((acc, v) => acc + pick(v.pnl), 0));
  vm.pnl.revenue = sumPnl((p) => p.revenue);
  vm.pnl.cogs = sumPnl((p) => p.cogs);
  vm.pnl.grossProfit = sumPnl((p) => p.grossProfit);
  vm.pnl.operatingExpenses = sumPnl((p) => p.operatingExpenses);
  vm.pnl.ebitda = sumPnl((p) => p.ebitda);
  vm.pnl.grossMarginPct =
    vm.pnl.revenue === 0 ? 0 : round2((vm.pnl.grossProfit / vm.pnl.revenue) * 100);
  vm.pnl.ebitdaMarginPct =
    vm.pnl.revenue === 0 ? 0 : round2((vm.pnl.ebitda / vm.pnl.revenue) * 100);
  vm.pnl.steps = [
    { name: "Revenue", value: vm.pnl.revenue, kind: "base" },
    { name: "COGS", value: -vm.pnl.cogs, kind: "subtract" },
    { name: "Gross profit", value: vm.pnl.grossProfit, kind: "total" },
    { name: "Opex", value: -vm.pnl.operatingExpenses, kind: "subtract" },
    { name: "EBITDA", value: vm.pnl.ebitda, kind: "total" },
  ];
  vm.opexBreakdown = vm.opexBreakdown.map((o, i) => ({
    ...o,
    value: round2(vms.reduce((sum, v) => sum + v.opexBreakdown[i].value, 0)),
  }));

  // --- Cash flow waterfall: opening = first month's opening, closing = last
  // month's closing, the in/out flows in between sum across all months.
  vm.cashflow = vm.cashflow.map((step, i) => {
    if (step.kind === "base") return { ...step, value: first.cashflow[i].value };
    if (step.kind === "total") return { ...step, value: last.cashflow[i].value };
    return { ...step, value: round2(vms.reduce((sum, v) => sum + v.cashflow[i].value, 0)) };
  });

  // --- Cash named scalars: point-in-time (opening = first, closing = last).
  vm.cash.opening = first.cash.opening;
  vm.cash.closing = last.cash.closing;
  vm.cash.netMovement = round2(last.cash.closing - first.cash.opening);

  // monthlyFixedCost is a per-month figure → use the latest (not a sum).
  vm.monthlyFixedCost = last.monthlyFixedCost;
  // runwayMonths is point-in-time (closing / monthly cost) → keep latest.
  vm.runwayMonths = last.runwayMonths;

  // --- Sales: actual + goal are monthly flows → sum per owner (same order).
  vm.sales = vm.sales.map((p, i) => ({
    ...p,
    actual: round2(vms.reduce((sum, v) => sum + v.sales[i].actual, 0)),
    goal: round2(vms.reduce((sum, v) => sum + v.sales[i].goal, 0)),
  }));

  // --- Suppliers: spend is a monthly flow → sum per category, then recompute share.
  const supplierSpend = vm.suppliers.map((_, i) =>
    round2(vms.reduce((sum, v) => sum + v.suppliers[i].spend, 0)),
  );
  const totalSpend = supplierSpend.reduce((sum, s) => sum + s, 0);
  vm.suppliers = vm.suppliers.map((sup, i) => ({
    ...sup,
    spend: supplierSpend[i],
    share: totalSpend === 0 ? 0 : round2((supplierSpend[i] / totalSpend) * 100),
  }));

  // --- Working capital: point-in-time balances → keep latest (already cloned).

  // --- Payroll: euros are monthly flows → sum; headcount/pcts point-in-time/ratios.
  const pay = vm.payroll;
  pay.bankOutflow = round2(vms.reduce((sum, v) => sum + v.payroll.bankOutflow, 0));
  pay.trueEmployerCost = round2(vms.reduce((sum, v) => sum + v.payroll.trueEmployerCost, 0));
  pay.employerWedge = round2(vms.reduce((sum, v) => sum + v.payroll.employerWedge, 0));
  pay.hidden = round2(vms.reduce((sum, v) => sum + v.payroll.hidden, 0));
  pay.components = pay.components.map((c, i) => ({
    ...c,
    value: round2(vms.reduce((sum, v) => sum + v.payroll.components[i].value, 0)),
  }));
  pay.hiddenBreakdown = pay.hiddenBreakdown.map((c, i) => ({
    ...c,
    value: round2(vms.reduce((sum, v) => sum + v.payroll.hiddenBreakdown[i].value, 0)),
  }));
  pay.employerWedgePct =
    pay.bankOutflow === 0 ? 0 : Math.round((pay.employerWedge / pay.bankOutflow) * 100);
  pay.hiddenPct =
    pay.trueEmployerCost === 0 ? 0 : Math.round((pay.hidden / pay.trueEmployerCost) * 100);
  // headcount kept from latest period (cloned).

  // --- KPIs: rebuild from the aggregated named scalars above.
  const aggNetCash = vm.cash.netMovement;
  vm.kpis = vm.kpis.map((kpi) => {
    switch (kpi.id) {
      case "revenue":
        return { ...kpi, value: vm.pnl.revenue, hint: `${vm.entity} · ${"Jan–May 2026 (all)"}` };
      case "grossMargin":
        return { ...kpi, value: vm.pnl.grossMarginPct };
      case "ebitda":
        return { ...kpi, value: vm.pnl.ebitda };
      case "closingCash":
        return { ...kpi, value: vm.cash.closing };
      case "netCash":
        return { ...kpi, value: aggNetCash, emphasis: aggNetCash > 0 ? "positive" : undefined };
      // accuracy (percent) left unchanged.
      default:
        return kpi;
    }
  });

  // --- Document intake counts are flows over the window → sum.
  vm.documentIntake = vm.documentIntake.map((chip, i) => ({
    ...chip,
    count: vms.reduce((sum, v) => sum + v.documentIntake[i].count, 0),
  }));

  // agents / citations / suggestedQuestions kept from the latest period (cloned).

  vm.period = "Jan–May 2026 (all)";
  vm.periodKey = "all"; // aggregate marker; buildLedger falls back to canonical May
  return vm;
}

export function buildPeriodData(baseReport: AnalysisReport): PeriodData {
  const baseVM = buildDashboardVM(baseReport); // canonical 2026-05 VM
  const defaultPeriod = baseReport.event.period;

  const vmByPeriod: Record<string, DashboardVM> = {};
  for (const p of PERIODS) {
    vmByPeriod[p.key] =
      p.key === defaultPeriod ? baseVM : scaleVM(baseVM, p.key, p.label, p.factor);
  }

  const aggregate = aggregateVMs(PERIODS.map((p) => vmByPeriod[p.key]));

  const trends: TrendPoint[] = PERIODS.map((p) => {
    const vm = vmByPeriod[p.key];
    return {
      period: p.short,
      revenue: kpiValue(vm, "revenue"),
      ebitda: kpiValue(vm, "ebitda"),
      closingCash: kpiValue(vm, "closingCash"),
      payrollGap: vm.payroll.hidden,
    };
  });

  return {
    periods: PERIODS.map((p) => ({ key: p.key, label: p.label, short: p.short })),
    defaultPeriod,
    vmByPeriod,
    aggregate,
    trends,
  };
}
