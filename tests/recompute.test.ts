import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extract, linkEvent } from "../lib/pipeline";
import { round2 } from "../lib/format";
import { buildBusinessIntelligence } from "../lib/business";
import { buildDashboardVM } from "../lib/dashboard-vm";
import {
  diffTiles,
  mergeDocuments,
  recomputeReport,
  splitUploaded,
} from "../lib/recompute";
import type { AnalysisReport, EmployeePayslip, ExtractedDocument } from "../lib/types";

// --- Uploaded-document fixtures (the shape /api/upload returns) --------------

function uploadedPayslip(over: Partial<EmployeePayslip> = {}): ExtractedDocument {
  return {
    doc_id: "upload-payslip-new",
    doc_type: "payslip",
    company: "Some Other Co", // deliberately different — must be normalized to base
    period: "2099-12",
    source_filename: "payslip_new.pdf",
    employee: {
      employee_id: "EMP-NEW",
      name: "Maria Testou",
      gross: 2000,
      employee_ika: 320,
      tax: 200,
      net: 1480,
      employer_ika: 520,
      employer_cost: 2520,
      ...over,
    },
  };
}

function uploadedBank(net: number): ExtractedDocument {
  return {
    doc_id: "upload-bank",
    doc_type: "bank_confirmation",
    company: "Some Other Co",
    period: "2099-12",
    source_filename: "bank_new.pdf",
    bank_net_total: net,
  };
}

function uploadedPurchase(net: number): ExtractedDocument {
  return {
    doc_id: "upload-purchase",
    doc_type: "purchase_invoice",
    company: "Some Other Co",
    period: "2099-12",
    source_filename: "purchase_new.pdf",
    counterparty: "New Vendor SA",
    net_amount: net,
    gross_amount: net * 1.24,
  };
}

function uploadedSale(net: number): ExtractedDocument {
  return {
    doc_id: "upload-sale",
    doc_type: "sales_invoice",
    company: "Some Other Co",
    period: "2099-12",
    source_filename: "sale_new.pdf",
    counterparty: "New Client Ltd",
    net_amount: net,
    gross_amount: net * 1.24,
  };
}

function baseReport(): AnalysisReport {
  return {
    event: linkEvent(extract()),
    validations: [],
    executive_summary: "base",
    analysis_engine: "deterministic-finance-engine",
    generated_at: "2026-06-29T00:00:00.000Z",
    db_mode: "embedded-demo",
  };
}

// --- splitUploaded ----------------------------------------------------------

describe("splitUploaded", () => {
  it("separates payroll docs from trade invoices and drops unknowns", () => {
    const split = splitUploaded([
      uploadedPayslip(),
      uploadedBank(5000),
      uploadedPurchase(1000),
      uploadedSale(2000),
      { doc_id: "x", doc_type: "unknown", company: "c", period: "p", source_filename: "x.pdf" },
    ]);
    assert.equal(split.payroll.length, 2);
    assert.equal(split.invoices.length, 2);
  });
});

// --- mergeDocuments ---------------------------------------------------------

describe("mergeDocuments", () => {
  it("appends a new payslip (by employee_id) and keeps the base anchor", () => {
    const base = extract();
    const merged = mergeDocuments(base, [uploadedPayslip()]);
    assert.equal(merged.length, base.length + 1);
    // Normalized onto the canonical company/period (not the uploaded "2099-12").
    for (const d of merged) {
      assert.equal(d.company, base[0].company);
      assert.equal(d.period, base[0].period);
    }
  });

  it("replaces the bank confirmation by type (no duplicate bank docs)", () => {
    const base = extract();
    const merged = mergeDocuments(base, [uploadedBank(5000)]);
    const banks = merged.filter((d) => d.doc_type === "bank_confirmation");
    assert.equal(banks.length, 1);
    assert.equal(banks[0].bank_net_total, 5000);
  });

  it("updates an existing payslip in place when employee_id matches", () => {
    const base = extract();
    // EMP-001 already exists in the sample — uploading it should replace, not add.
    const merged = mergeDocuments(base, [
      uploadedPayslip({ employee_id: "EMP-001", gross: 9999, employer_ika: 1, employer_cost: 10000 }),
    ]);
    assert.equal(merged.length, base.length); // replaced, not appended
    const emp = merged.find((d) => d.employee?.employee_id === "EMP-001");
    assert.equal(emp?.employee?.gross, 9999);
  });
});

// --- recomputeReport: payroll changes the fused totals ----------------------

describe("recomputeReport", () => {
  it("uploading a new payslip raises employer_cost_total and headcount (vs canonical 6930)", async () => {
    const canonical = baseReport();
    assert.equal(canonical.event.employer_cost_total, 6930); // canonical anchor
    assert.equal(canonical.event.employee_count, 3);

    const { report } = await recomputeReport([uploadedPayslip()]);
    // gross 5500+2000=7500, employer_ika 1430+520=1950 -> employer_cost 9450.
    assert.equal(report.event.employee_count, 4);
    assert.equal(report.event.employer_cost_total, 9450);
    assert.ok(report.event.employer_cost_total > canonical.event.employer_cost_total);
  });

  it("uploading a bank confirmation moves bank_net_total (replace-by-type)", async () => {
    const { report } = await recomputeReport([uploadedBank(5000)]);
    assert.equal(report.event.bank_net_total, 5000);
    // employer_cost_total stays payslip-derived (the canonical design).
    assert.equal(report.event.employer_cost_total, 6930);
  });

  it("returns uploaded trade invoices separately and never mutates the event for them", async () => {
    const { report, invoices } = await recomputeReport([uploadedPurchase(1000), uploadedSale(2000)]);
    assert.equal(invoices.length, 2);
    assert.equal(report.event.employer_cost_total, 6930); // unchanged by invoices
    assert.equal(report.db_mode, "embedded-demo");
  });
});

// --- Invoice folding into business intelligence -----------------------------

describe("buildBusinessIntelligence invoice folding", () => {
  it("is byte-identical to canonical when no invoices are supplied", () => {
    const bi = buildBusinessIntelligence(baseReport(), []);
    assert.equal(bi.pnl.revenue, 47200); // canonical revenue
    // operatingExpenses = employer_cost_total (6930) + fixedOpex (8500).
    assert.equal(bi.pnl.operatingExpenses, 15430);
  });

  it("a purchase invoice raises COGS (and lowers EBITDA)", () => {
    const report = baseReport();
    const base = buildBusinessIntelligence(report, []);
    const withPurchase = buildBusinessIntelligence(report, [uploadedPurchase(1000)]);
    assert.equal(withPurchase.pnl.cogs, round2(base.pnl.cogs + 1000));
    assert.ok(withPurchase.pnl.ebitda < base.pnl.ebitda);
    // New vendor surfaces as its own purchase category.
    assert.ok(withPurchase.purchases.categories.some((c) => c.vendor === "New Vendor SA"));
  });

  it("a sales invoice raises revenue without distorting the blended margin", () => {
    const report = baseReport();
    const base = buildBusinessIntelligence(report, []);
    const withSale = buildBusinessIntelligence(report, [uploadedSale(5000)]);
    assert.equal(withSale.pnl.revenue, 47200 + 5000);
    // Uploaded sale carries the blended margin -> weighted margin essentially stable.
    assert.ok(Math.abs(withSale.sales.weightedMarginPct - base.sales.weightedMarginPct) < 0.01);
  });
});

// --- diffTiles --------------------------------------------------------------

describe("diffTiles", () => {
  it("flags payroll + KPI tiles when a payslip changes the close", async () => {
    const oldVM = buildDashboardVM(baseReport());
    const { report, invoices } = await recomputeReport([uploadedPayslip()]);
    const newVM = buildDashboardVM(report, invoices);
    const changed = diffTiles(oldVM, newVM);
    assert.ok(changed.includes("payroll"));
    assert.ok(changed.includes("pnl"));
    // EBITDA shifts because opex (true employer cost) grew.
    assert.ok(changed.includes("kpi:ebitda"));
  });

  it("returns no keys when the view-models are identical", () => {
    const vm = buildDashboardVM(baseReport());
    assert.deepEqual(diffTiles(vm, vm), []);
  });
});
