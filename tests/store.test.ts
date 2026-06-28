import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoStore } from "../lib/store";
import { extract, linkEvent, validate } from "../lib/pipeline";
import samplePayroll from "../data/sample-payroll.json";
import type { AnalysisReport, AuditActivity } from "../lib/types";

// A fake DocumentClient that records the commands it is sent and returns canned
// responses. Lets us assert the exact DynamoDB command shape the production code
// issues — without any live AWS credentials.
class FakeDocClient {
  public commands: Array<PutCommand | QueryCommand> = [];
  constructor(private readonly responses: { query?: unknown } = {}) {}
  async send(command: PutCommand | QueryCommand): Promise<unknown> {
    this.commands.push(command);
    if (command instanceof QueryCommand) {
      return this.responses.query ?? { Items: [] };
    }
    return {};
  }
}

function sampleReport(): AnalysisReport {
  const docs = extract(samplePayroll);
  const event = linkEvent(docs);
  return {
    event,
    validations: validate(event, docs),
    executive_summary: "Unit-test report.",
    analysis_engine: "deterministic-finance-engine",
    generated_at: "2026-05-31T12:00:00.000Z",
    db_mode: "embedded-demo",
  };
}

const asClient = (fake: FakeDocClient) => fake as unknown as DynamoDBDocumentClient;

describe("DynamoStore report persistence", () => {
  it("writes a REPORT item with a collision-safe sort key", async () => {
    const fake = new FakeDocClient();
    const store = new DynamoStore("h0-test-table", asClient(fake));
    const report = sampleReport();

    await store.persistReport(report);

    assert.equal(fake.commands.length, 1);
    const cmd = fake.commands[0];
    assert.ok(cmd instanceof PutCommand);
    const { TableName, Item } = (cmd as PutCommand).input;
    const item = Item as Record<string, any>;
    assert.equal(TableName, "h0-test-table");
    assert.equal(item.pk, "REPORT");
    assert.equal(item.sk, "2026-05-31T12:00:00.000Z#evt-eleftheria-foods-ae-2026-05");
    assert.equal(item.event_id, "evt-eleftheria-foods-ae-2026-05");
    assert.equal(item.created_at, "2026-05-31T12:00:00.000Z");
    assert.equal(item.report.db_mode, "aws-dynamodb");
    assert.equal(item.report.event.employer_cost_total, 9110.62);
  });

  it("reads the latest REPORT with a descending, limit-1 query", async () => {
    const stored = { ...sampleReport(), db_mode: "aws-dynamodb" as const };
    const fake = new FakeDocClient({ query: { Items: [{ report: stored }] } });
    const store = new DynamoStore("h0-test-table", asClient(fake));

    const latest = await store.getLatestReport();

    const cmd = fake.commands[0] as QueryCommand;
    assert.ok(cmd instanceof QueryCommand);
    assert.equal(cmd.input.ScanIndexForward, false);
    assert.equal(cmd.input.Limit, 1);
    assert.deepEqual(cmd.input.ExpressionAttributeValues, { ":pk": "REPORT" });
    assert.equal(latest?.event.event_id, "evt-eleftheria-foods-ae-2026-05");
    assert.equal(latest?.db_mode, "aws-dynamodb");
  });

  it("returns null when no report exists", async () => {
    const fake = new FakeDocClient({ query: { Items: [] } });
    const store = new DynamoStore("h0-test-table", asClient(fake));
    assert.equal(await store.getLatestReport(), null);
  });
});

describe("DynamoStore activity persistence", () => {
  it("writes an ACTIVITY item with a composite sort key", async () => {
    const fake = new FakeDocClient();
    const store = new DynamoStore("h0-test-table", asClient(fake));
    const record: AuditActivity = {
      activity_id: "ask-123",
      kind: "ask",
      summary: "What is the payroll gap?",
      details: { source_ids: ["SRC-PAY"] },
      created_at: "2026-06-28T08:00:00.000Z",
      db_mode: "embedded-demo",
    };

    const result = await store.persistActivity(record);

    const cmd = fake.commands[0] as PutCommand;
    assert.ok(cmd instanceof PutCommand);
    const item = cmd.input.Item as Record<string, any>;
    assert.equal(item.pk, "ACTIVITY");
    assert.equal(item.sk, "2026-06-28T08:00:00.000Z#ask-123");
    assert.equal(item.kind, "ask");
    assert.equal(result.db_mode, "aws-dynamodb");
  });

  it("reads activity with a descending query on the ACTIVITY partition", async () => {
    const activity: AuditActivity = {
      activity_id: "ask-123",
      kind: "ask",
      summary: "What is the payroll gap?",
      details: {},
      created_at: "2026-06-28T08:00:00.000Z",
      db_mode: "aws-dynamodb",
    };
    const fake = new FakeDocClient({ query: { Items: [{ activity }] } });
    const store = new DynamoStore("h0-test-table", asClient(fake));

    const history = await store.getActivityHistory(10);

    const cmd = fake.commands[0] as QueryCommand;
    assert.deepEqual(cmd.input.ExpressionAttributeValues, { ":pk": "ACTIVITY" });
    assert.equal(cmd.input.ScanIndexForward, false);
    assert.equal(history.length, 1);
    assert.equal(history[0].activity_id, "ask-123");
  });
});
