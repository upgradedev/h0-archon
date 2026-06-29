import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { buildDashboardVM, type DashboardVM } from "../lib/dashboard-vm";
import { buildLedger } from "../lib/demo-ledger";
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

function vm(): DashboardVM {
  return buildDashboardVM(fixtureReport());
}

const revenueOf = (v: DashboardVM): number => round2(v.pnl.revenue);
const cogsOf = (v: DashboardVM): number => round2(v.pnl.cogs);

const sumTotals = (accounts: { total: number }[]): number =>
  round2(accounts.reduce((s, a) => s + a.total, 0));

describe("demo ledger", () => {
  it("reconciles customer totals to revenue (exact)", () => {
    const v = vm();
    const ledger = buildLedger(v);
    assert.equal(sumTotals(ledger.customers), revenueOf(v));
    assert.equal(ledger.arTotal, revenueOf(v));
  });

  it("reconciles supplier totals to COGS (exact)", () => {
    const v = vm();
    const ledger = buildLedger(v);
    assert.equal(sumTotals(ledger.suppliers), cogsOf(v));
    assert.equal(ledger.apTotal, cogsOf(v));
  });

  it("makes each account total equal the sum of its invoice amounts", () => {
    const ledger = buildLedger(vm());
    for (const acc of [...ledger.customers, ...ledger.suppliers]) {
      const invoiceSum = round2(acc.invoices.reduce((s, t) => s + t.amount, 0));
      assert.equal(invoiceSum, acc.total, `${acc.name} invoices must sum to total`);
      const openSum = round2(
        acc.invoices.filter((t) => t.status === "open").reduce((s, t) => s + t.amount, 0),
      );
      assert.equal(openSum, acc.openBalance, `${acc.name} open invoices must sum to openBalance`);
      const paid = acc.invoices.filter((t) => t.status === "paid").length;
      assert.equal(paid, acc.paidCount, `${acc.name} paidCount must match paid invoices`);
    }
  });

  it("approximates receivables and payables with the open balances", () => {
    const v = vm();
    const ledger = buildLedger(v);
    const receivables = v.workingCapital.receivables.value;
    const payables = v.workingCapital.payables.value;

    assert.equal(
      ledger.arOpen,
      round2(ledger.customers.reduce((s, a) => s + a.openBalance, 0)),
    );
    assert.equal(
      ledger.apOpen,
      round2(ledger.suppliers.reduce((s, a) => s + a.openBalance, 0)),
    );

    const arErr = Math.abs(ledger.arOpen - receivables) / receivables;
    const apErr = Math.abs(ledger.apOpen - payables) / payables;
    assert.ok(arErr <= 0.1, `arOpen ${ledger.arOpen} within 10% of receivables ${receivables} (err ${arErr})`);
    assert.ok(apErr <= 0.1, `apOpen ${ledger.apOpen} within 10% of payables ${payables} (err ${apErr})`);
  });

  it("sorts accounts by total descending", () => {
    const ledger = buildLedger(vm());
    for (const accounts of [ledger.customers, ledger.suppliers]) {
      for (let i = 1; i < accounts.length; i++) {
        assert.ok(accounts[i - 1].total >= accounts[i].total);
      }
    }
  });

  it("is deterministic", () => {
    const v = vm();
    assert.deepEqual(buildLedger(v), buildLedger(v));
  });
});
