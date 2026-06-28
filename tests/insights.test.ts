import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import {
  buildCashPlanningInsight,
  buildDocumentSources,
  buildJudgeEvidence,
  buildWorkflowSteps,
} from "../lib/insights";
import { extract, linkEvent, validate } from "../lib/pipeline";
import type { AnalysisReport } from "../lib/types";

function fixtureReport(dbMode: AnalysisReport["db_mode"] = "aws-dynamodb"): AnalysisReport {
  const docs = extract(samplePayroll);
  const event = linkEvent(docs);
  return {
    event,
    validations: validate(event, docs),
    executive_summary: "Fixture.",
    narrator_model: "fallback-template",
    generated_at: "2026-06-28T06:00:00.000Z",
    db_mode: dbMode,
  };
}

describe("judge insight model", () => {
  it("builds source document evidence from a payroll report", () => {
    const docs = buildDocumentSources(fixtureReport());

    assert.equal(docs.length, 3);
    assert.equal(docs[0].id, "bank");
    assert.match(docs[1].captured, /true employer cost/);
    assert.match(docs[2].filename, /5 payslip/);
  });

  it("builds an auditable workflow ledger", () => {
    const workflow = buildWorkflowSteps(fixtureReport());

    assert.deepEqual(workflow.map((step) => step.id), ["extract", "link", "validate", "persist", "narrate"]);
    assert.equal(workflow.find((step) => step.id === "persist")?.status, "stored");
  });

  it("computes cash planning numbers from fused payroll truth", () => {
    const cash = buildCashPlanningInsight(fixtureReport());

    assert.equal(cash.bankOnlyMonthly, 5956.67);
    assert.equal(cash.trueMonthlyCost, 9110.62);
    assert.equal(cash.monthlyUnderstatement, 3153.95);
    assert.equal(Number(cash.averageEmployerCostPerEmployee.toFixed(2)), 1822.12);
  });

  it("marks AWS database evidence as ready for DynamoDB", () => {
    const evidence = buildJudgeEvidence(fixtureReport("aws-dynamodb"));

    assert.equal(evidence.stack.find((item) => item.label === "Database")?.status, "ready");
    assert.match(evidence.proof.join(" "), /db_mode=aws-dynamodb/);
    assert.ok(evidence.endpoints.some((endpoint) => endpoint.path === "/api/history"));
  });
});
