import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { buildDashboardVM } from "../lib/dashboard-vm";
import { buildPeriodData, PERIODS } from "../lib/demo-periods";
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

const kpi = (vm: ReturnType<typeof buildDashboardVM>, id: string): number =>
  vm.kpis.find((k) => k.id === id)?.value ?? 0;

describe("multi-period demo data", () => {
  it("keeps May canonical except for real month-over-month KPI deltas", () => {
    // buildPeriodData now layers REAL month-over-month deltas onto every period
    // after January, so May carries non-zero deltas vs April. May is therefore no
    // longer byte-for-byte identical to a fresh (delta-free) buildDashboardVM —
    // but it must remain identical in every OTHER field. We assert that by
    // zeroing May's KPI deltas and deep-comparing to the canonical VM.
    const report = fixtureReport();
    const data = buildPeriodData(report);
    const canonical = buildDashboardVM(report);

    assert.equal(data.defaultPeriod, "2026-05");

    const may = data.vmByPeriod["2026-05"];
    const mayDeltasZeroed = {
      ...may,
      kpis: may.kpis.map((k) => ({ ...k, delta: 0 })),
    };
    assert.deepEqual(mayDeltasZeroed, canonical);

    // And the new behaviour is real: May's euro KPIs grow vs April (~+4.2%),
    // while the constant accuracy KPI carries no trend.
    const mayDelta = (id: string): number =>
      may.kpis.find((k) => k.id === id)?.delta ?? 0;
    assert.ok(mayDelta("revenue") > 0);
    assert.ok(mayDelta("ebitda") > 0);
    assert.ok(mayDelta("closingCash") > 0);
    assert.equal(mayDelta("accuracy"), 0);
  });

  it("leaves January (first month) and the aggregate at zero KPI deltas", () => {
    const data = buildPeriodData(fixtureReport());
    for (const k of data.vmByPeriod["2026-01"].kpis) {
      assert.equal(k.delta, 0);
    }
    for (const k of data.aggregate.kpis) {
      assert.equal(k.delta, 0);
    }
  });

  it("scales euro fields by the period factor", () => {
    const data = buildPeriodData(fixtureReport());
    const may = data.vmByPeriod["2026-05"];
    const jan = data.vmByPeriod["2026-01"];

    assert.equal(kpi(jan, "revenue"), round2(kpi(may, "revenue") * 0.82));
    assert.equal(kpi(jan, "ebitda"), round2(kpi(may, "ebitda") * 0.82));
    assert.equal(kpi(jan, "closingCash"), round2(kpi(may, "closingCash") * 0.82));
    assert.equal(jan.payroll.hidden, round2(may.payroll.hidden * 0.82));
  });

  it("leaves percentages and ratios invariant under scaling", () => {
    const data = buildPeriodData(fixtureReport());
    const may = data.vmByPeriod["2026-05"];
    const jan = data.vmByPeriod["2026-01"];

    assert.equal(kpi(jan, "grossMargin"), kpi(may, "grossMargin"));
    assert.equal(kpi(jan, "accuracy"), kpi(may, "accuracy"));
    assert.equal(jan.runwayMonths, may.runwayMonths);
    assert.equal(jan.payroll.employerWedgePct, may.payroll.employerWedgePct);
    assert.equal(jan.payroll.headcount, may.payroll.headcount);
  });

  it("produces five strictly ascending revenue trend points", () => {
    const data = buildPeriodData(fixtureReport());

    assert.equal(data.trends.length, 5);
    assert.deepEqual(
      data.trends.map((t) => t.period),
      ["Jan", "Feb", "Mar", "Apr", "May"],
    );
    for (let i = 1; i < data.trends.length; i++) {
      assert.ok(data.trends[i].revenue > data.trends[i - 1].revenue);
    }
  });

  it("aggregates flows by sum and balances point-in-time", () => {
    const data = buildPeriodData(fixtureReport());
    const agg = data.aggregate;

    const revenueSum = round2(
      PERIODS.reduce((sum, p) => sum + kpi(data.vmByPeriod[p.key], "revenue"), 0),
    );
    assert.equal(kpi(agg, "revenue"), revenueSum);

    // Closing cash is point-in-time → equals the last period (May), not a sum.
    assert.equal(kpi(agg, "closingCash"), kpi(data.vmByPeriod["2026-05"], "closingCash"));
  });
});
