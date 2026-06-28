import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { dbMode, getActivityHistory, getLatestReport, persistActivity, persistReport } from "../lib/db";
import { extract, linkEvent, validate } from "../lib/pipeline";
import samplePayroll from "../data/sample-payroll.json";
import type { AnalysisReport } from "../lib/types";

const managedEnvKeys = [
  "DYNAMODB_TABLE",
  "AWS_DYNAMODB_TABLE",
  "DATABASE_URL",
] as const;

const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of managedEnvKeys) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of managedEnvKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  originalEnv.clear();
});

describe("db mode selection", () => {
  it("uses embedded demo mode when no cloud database is configured", () => {
    assert.equal(dbMode(), "embedded-demo");
  });

  it("uses Aurora PostgreSQL when only DATABASE_URL is configured", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/h0";

    assert.equal(dbMode(), "aurora-postgres");
  });

  it("prefers DynamoDB over Aurora when both are configured", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.invalid:5432/h0";
    process.env.DYNAMODB_TABLE = "h0-archon-reports";

    assert.equal(dbMode(), "aws-dynamodb");
  });

  it("accepts AWS_DYNAMODB_TABLE as the DynamoDB table alias", () => {
    process.env.AWS_DYNAMODB_TABLE = "h0-archon-reports";

    assert.equal(dbMode(), "aws-dynamodb");
  });
});

describe("embedded demo persistence", () => {
  it("stores and returns the latest finance report without AWS credentials", async () => {
    const docs = extract(samplePayroll);
    const event = linkEvent(docs);
    const report: AnalysisReport = {
      event,
      validations: validate(event, docs),
      executive_summary: "Unit-test report.",
      analysis_engine: "test-fixture",
      generated_at: "2026-05-31T12:00:00.000Z",
      db_mode: "embedded-demo",
    };

    await persistReport(report);

    const latest = await getLatestReport();
    assert.equal(latest?.event.event_id, "evt-eleftheria-foods-ae-2026-05");
    assert.equal(latest?.event.employer_cost_total, 9110.62);
    assert.equal(latest?.db_mode, "embedded-demo");
  });

  it("stores intake and ask activity without AWS credentials", async () => {
    const activity = await persistActivity({
      kind: "ask",
      summary: "Answered finance question in unit test",
      details: {
        question: "What is the payroll gap?",
        source_ids: ["SRC-PAY"],
      },
      activity_id: "ask-unit-test",
      created_at: "2026-06-28T08:00:00.000Z",
    });

    const history = await getActivityHistory(10);

    assert.equal(activity.db_mode, "embedded-demo");
    assert.ok(history.some((item) => item.activity_id === "ask-unit-test"));
    assert.equal(history.find((item) => item.activity_id === "ask-unit-test")?.kind, "ask");
  });
});
