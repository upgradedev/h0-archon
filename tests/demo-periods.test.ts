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
  it("keeps January canonical (the authentic month) byte-for-byte", () => {
    // January is the authentic, real close (factor 1.0) and the FIRST month, so
    // the month-over-month delta pass never touches it. It must therefore be
    // byte-for-byte identical to a fresh buildDashboardVM. Later months are
    // projected forward and carry real positive deltas.
    const report = fixtureReport();
    const data = buildPeriodData(report);
    const canonical = buildDashboardVM(report);

    assert.equal(data.defaultPeriod, "2026-01");

    const jan = data.vmByPeriod["2026-01"];
    assert.deepEqual(jan, canonical);

    // And the forward projection is real: February's euro KPIs grow vs January,
    // while the constant accuracy KPI carries no trend.
    const feb = data.vmByPeriod["2026-02"];
    const febDelta = (id: string): number =>
      feb.kpis.find((k) => k.id === id)?.delta ?? 0;
    assert.ok(febDelta("revenue") > 0);
    assert.ok(febDelta("ebitda") > 0);
    assert.ok(febDelta("closingCash") > 0);
    assert.equal(febDelta("accuracy"), 0);
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

  it("scales euro fields forward by the period factor", () => {
    const data = buildPeriodData(fixtureReport());
    const may = data.vmByPeriod["2026-05"]; // projected forward, factor 1.18
    const jan = data.vmByPeriod["2026-01"]; // canonical, factor 1.0

    assert.equal(kpi(may, "revenue"), round2(kpi(jan, "revenue") * 1.18));
    assert.equal(kpi(may, "ebitda"), round2(kpi(jan, "ebitda") * 1.18));
    assert.equal(kpi(may, "closingCash"), round2(kpi(jan, "closingCash") * 1.18));
    assert.equal(may.payroll.hidden, round2(jan.payroll.hidden * 1.18));
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
