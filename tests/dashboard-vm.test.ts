import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { buildBusinessIntelligence } from "../lib/business";
import { buildDashboardVM } from "../lib/dashboard-vm";
import { round2 } from "../lib/format";
import { extract, linkEvent, validate } from "../lib/pipeline";
import type { AnalysisReport } from "../lib/types";

function fixtureReport(): AnalysisReport {
  const docs = extract(samplePayroll);
  const event = linkEvent(docs);
  return {
    event,
    validations: validate(event, docs),
    executive_summary: "Fixture.",
    analysis_engine: "deterministic-finance-engine",
    generated_at: "2026-06-28T06:00:00.000Z",
    db_mode: "aws-dynamodb",
  };
}

describe("buildDashboardVM named scalars", () => {
  it("mirrors the underlying business-intelligence P&L scalars", () => {
    const report = fixtureReport();
    const bi = buildBusinessIntelligence(report);
    const vm = buildDashboardVM(report);

    assert.equal(vm.pnl.revenue, bi.pnl.revenue);
    assert.equal(vm.pnl.cogs, bi.pnl.cogs);
    assert.equal(vm.pnl.grossProfit, bi.pnl.grossProfit);
    assert.equal(vm.pnl.operatingExpenses, bi.pnl.operatingExpenses);
    assert.equal(vm.pnl.ebitda, bi.pnl.ebitda);
    assert.equal(vm.pnl.grossMarginPct, bi.pnl.grossMarginPct);
    assert.equal(vm.pnl.ebitdaMarginPct, bi.pnl.ebitdaMarginPct);
  });

  it("mirrors the underlying cash scalars", () => {
    const report = fixtureReport();
    const bi = buildBusinessIntelligence(report);
    const vm = buildDashboardVM(report);

    assert.equal(vm.cash.opening, bi.cash.openingBalance);
    assert.equal(vm.cash.closing, bi.cash.closingBalance);
    assert.equal(vm.cash.netMovement, bi.cash.netMovement);
  });

  it("keeps the display steps consistent with the named scalars", () => {
    const vm = buildDashboardVM(fixtureReport());

    assert.deepEqual(
      vm.pnl.steps.map((s) => s.name),
      ["Revenue", "COGS", "Gross profit", "Opex", "EBITDA"],
    );
    // COGS / Opex stored NEGATIVE for the waterfall; magnitudes match scalars.
    const byName = (name: string) => vm.pnl.steps.find((s) => s.name === name)?.value ?? 0;
    assert.equal(byName("Revenue"), vm.pnl.revenue);
    assert.equal(byName("COGS"), -vm.pnl.cogs);
    assert.equal(byName("Gross profit"), vm.pnl.grossProfit);
    assert.equal(byName("Opex"), -vm.pnl.operatingExpenses);
    assert.equal(byName("EBITDA"), vm.pnl.ebitda);
  });

  it("exposes the raw period key", () => {
    const report = fixtureReport();
    const vm = buildDashboardVM(report);
    assert.equal(vm.periodKey, report.event.period);
    assert.equal(vm.periodKey, "2026-01");
  });

  it("emits the six expected KPI tiles", () => {
    const vm = buildDashboardVM(fixtureReport());
    assert.equal(vm.kpis.length, 6);
    assert.deepEqual(
      vm.kpis.map((k) => k.id),
      ["revenue", "grossMargin", "ebitda", "closingCash", "netCash", "accuracy"],
    );
  });

  it("derives payroll wedge and hidden cost from the event", () => {
    const report = fixtureReport();
    const event = report.event;
    const vm = buildDashboardVM(report);

    assert.equal(vm.payroll.employerWedge, event.employer_ika_total);
    assert.equal(vm.payroll.hidden, event.hidden_total);
    assert.equal(vm.payroll.employerWedgePct, Math.round(event.cost_gap_pct));
    assert.equal(vm.payroll.bankOutflow, event.bank_net_total);
    assert.equal(vm.payroll.trueEmployerCost, event.employer_cost_total);
    assert.equal(vm.payroll.headcount, event.employee_count);
    // hiddenBreakdown sums to hidden (employer IKA + employee IKA + tax withheld).
    const breakdownSum = vm.payroll.hiddenBreakdown.reduce((s, c) => s + c.value, 0);
    assert.equal(breakdownSum, event.hidden_total);
  });

  it("exposes per-employee payroll that reconciles to the true employer cost", () => {
    const report = fixtureReport();
    const vm = buildDashboardVM(report);
    // One row per payslip in the fused event.
    assert.equal(vm.payroll.employees.length, vm.payroll.headcount);
    assert.equal(vm.payroll.employees.length, report.event.employees.length);
    // Sum of per-employee employer cost ≈ the headline true employer cost.
    const employerCostSum = round2(
      vm.payroll.employees.reduce((s, e) => s + e.employerCost, 0),
    );
    assert.ok(
      Math.abs(employerCostSum - vm.payroll.trueEmployerCost) <= 0.02,
      `sum(employerCost) ${employerCostSum} ≈ trueEmployerCost ${vm.payroll.trueEmployerCost}`,
    );
  });

  it("populates citations and the eight-agent pipeline", () => {
    const vm = buildDashboardVM(fixtureReport());
    assert.ok(vm.citations.length > 0);
    assert.equal(vm.agents.length, 8);
    // ids are unique and run 1..8 in pipeline order.
    assert.deepEqual(
      vm.agents.map((a) => a.id),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      vm.agents.map((a) => a.name),
      ["Extractor", "Classifier", "Event Linker", "Validator", "PnL", "CashFlow", "Employee", "Narrator"],
    );
    assert.ok(vm.suggestedQuestions.length > 0);
  });

  it("preserves the canonical January payroll figures", () => {
    const vm = buildDashboardVM(fixtureReport());
    assert.equal(vm.pnl.revenue, 47200);
    assert.equal(vm.payroll.trueEmployerCost, 6930);
    assert.equal(vm.payroll.employerWedgePct, 36); // round(35.80)
  });
});
