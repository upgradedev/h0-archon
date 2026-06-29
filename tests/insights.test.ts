import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { buildBusinessIntelligence } from "../lib/business";
import {
  buildAccountingCitations,
  buildCashPlanningInsight,
  buildDocumentSources,
  buildJudgeEvidence,
  buildReportResponse,
  buildWorkflowSteps,
} from "../lib/insights";
import { buildIntakeResponse } from "../lib/intake";
import { extract, linkEvent, validate } from "../lib/pipeline";
import { buildFinanceAnswer } from "../lib/qa";
import type { AnalysisReport } from "../lib/types";

function fixtureReport(dbMode: AnalysisReport["db_mode"] = "aws-dynamodb"): AnalysisReport {
  const docs = extract(samplePayroll);
  const event = linkEvent(docs);
  return {
    event,
    validations: validate(event, docs),
    executive_summary: "Fixture.",
    analysis_engine: "deterministic-finance-engine",
    generated_at: "2026-06-28T06:00:00.000Z",
    db_mode: dbMode,
  };
}

describe("judge insight model", () => {
  it("builds source document evidence from a finance report", () => {
    const docs = buildDocumentSources(fixtureReport());

    assert.equal(docs.length, 5);
    assert.equal(docs[0].id, "bank");
    assert.equal(docs[1].id, "sales");
    assert.equal(docs[2].id, "purchases");
    assert.match(docs[3].captured, /true employer cost/);
    assert.match(docs[4].filename, /3 payslip/);
  });

  it("builds an auditable workflow ledger", () => {
    const workflow = buildWorkflowSteps(fixtureReport());

    assert.deepEqual(workflow.map((step) => step.id), ["intake", "classify", "extract", "link", "validate", "persist", "analyze"]);
    assert.equal(workflow.find((step) => step.id === "persist")?.status, "stored");
  });

  it("computes cash planning numbers from fused payroll truth", () => {
    const cash = buildCashPlanningInsight(fixtureReport());

    assert.equal(cash.bankOnlyMonthly, 3994.74);
    assert.equal(cash.trueMonthlyCost, 6930);
    assert.equal(cash.monthlyUnderstatement, 2935.26);
    assert.equal(Number(cash.averageEmployerCostPerEmployee.toFixed(2)), 2310.0);
  });

  it("marks AWS database evidence as ready for DynamoDB", () => {
    const evidence = buildJudgeEvidence(fixtureReport("aws-dynamodb"));

    assert.equal(evidence.stack.find((item) => item.label === "Database")?.status, "ready");
    assert.equal(evidence.stack.find((item) => item.label === "Audit trail")?.status, "ready");
    assert.match(evidence.proof.join(" "), /db_mode=aws-dynamodb/);
    assert.match(evidence.proof.join(" "), /records=REPORT\+ACTIVITY/);
    assert.ok(evidence.endpoints.some((endpoint) => endpoint.path === "/api/history"));
  });

  it("builds full SMB finance intelligence beyond payroll", () => {
    const intelligence = buildBusinessIntelligence(fixtureReport());

    assert.equal(intelligence.pnl.revenue, 47200);
    assert.equal(intelligence.sales.attainmentPct, 101.51);
    assert.equal(intelligence.purchases.categories[0].risk, "watch");
    assert.ok(intelligence.brief.includes("EBITDA"));
  });

  it("enriches the API report with business intelligence", () => {
    const response = buildReportResponse(fixtureReport());

    assert.equal(response.analysis_engine, "deterministic-finance-engine");
    assert.equal(response.business_intelligence.pnl.revenue, 47200);
    assert.equal(response.business_intelligence.cash.closingBalance, 79497.55);
    assert.equal(response.citations.length, 4);
  });

  it("builds source-backed accounting citations", () => {
    const citations = buildAccountingCitations(fixtureReport());

    assert.deepEqual(citations.map((citation) => citation.id), ["SRC-REV", "SRC-COGS", "SRC-CASH", "SRC-PAY"]);
    assert.match(citations[3].evidence, /true cost/);
  });

  it("classifies uploaded finance documents by role", () => {
    const intake = buildIntakeResponse([
      { name: "bank_confirmation_202601.pdf", size: 1 },
      { name: "sales_ledger_202601.xlsx", size: 1 },
      { name: "vendor_purchases_202601.xlsx", size: 1 },
      { name: "payroll_register_202601.pdf", size: 1 },
    ]);

    assert.equal(intake.ready_for_close, true);
    assert.deepEqual(intake.coverage, ["bank", "sales", "purchases", "payroll"]);
  });

  it("answers finance questions with source evidence", () => {
    const answer = buildFinanceAnswer(fixtureReport(), "What is our true payroll cost compared to the bank?");

    assert.match(answer.answer, /True payroll cost/);
    assert.equal(answer.sources.length, 4);
  });
});
