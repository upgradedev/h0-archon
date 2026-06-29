// Persistence layer.
//
// One `FinanceStore` interface, selected once by environment:
//   - DynamoStore  : AWS DynamoDB (the serverless AWS path, DYNAMODB_TABLE)
//   - MemoryStore  : in-process demo store (no cloud database configured)
//
// The DynamoDB client is injected into DynamoStore so the production read/write
// command shapes can be unit-tested without live AWS credentials.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AnalysisReport, AuditActivity } from "./types";
import { normalizeActivity, normalizeReport } from "./normalize";

const REPORT_PK = "REPORT";
const ACTIVITY_PK = "ACTIVITY";
// Partition for atomic daily counters (rate limiting). Kept off the REPORT /
// ACTIVITY partitions so it never appears in report/activity queries.
const RATELIMIT_PK = "RATELIMIT";

export interface FinanceStore {
  readonly mode: AnalysisReport["db_mode"];
  persistReport(report: AnalysisReport): Promise<void>;
  getLatestReport(): Promise<AnalysisReport | null>;
  getReportHistory(limit: number): Promise<AnalysisReport[]>;
  persistActivity(record: AuditActivity): Promise<AuditActivity>;
  getActivityHistory(limit: number): Promise<AuditActivity[]>;
  // Atomically add 1 to a named daily counter and return the new value.
  // `ttlEpochSeconds` is written once (if absent) so the item self-expires.
  incrementDailyCounter(key: string, ttlEpochSeconds: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// AWS DynamoDB — single-table store
// ---------------------------------------------------------------------------
export class DynamoStore implements FinanceStore {
  readonly mode = "aws-dynamodb" as const;

  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient
  ) {}

  async persistReport(report: AnalysisReport): Promise<void> {
    const stored = normalizeReport({ ...report, db_mode: "aws-dynamodb" });
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: REPORT_PK,
          // sk includes event_id so two reports generated in the same
          // millisecond do not silently overwrite each other; the ISO
          // timestamp prefix keeps descending-sk ordering correct.
          sk: `${stored.generated_at}#${stored.event.event_id}`,
          event_id: stored.event.event_id,
          created_at: stored.generated_at,
          report: stored,
        },
      })
    );
  }

  async getLatestReport(): Promise<AnalysisReport | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": REPORT_PK },
        ScanIndexForward: false,
        Limit: 1,
      })
    );
    const latest = result.Items?.[0]?.report as AnalysisReport | undefined;
    return latest ? normalizeReport({ ...latest, db_mode: "aws-dynamodb" }) : null;
  }

  async getReportHistory(limit: number): Promise<AnalysisReport[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": REPORT_PK },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items || [])
      .map((item) => item.report as AnalysisReport | undefined)
      .filter((report): report is AnalysisReport => Boolean(report))
      .map((report) => normalizeReport({ ...report, db_mode: "aws-dynamodb" }));
  }

  async persistActivity(record: AuditActivity): Promise<AuditActivity> {
    const stored: AuditActivity = { ...record, db_mode: "aws-dynamodb" };
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: ACTIVITY_PK,
          sk: `${stored.created_at}#${stored.activity_id}`,
          activity_id: stored.activity_id,
          kind: stored.kind,
          created_at: stored.created_at,
          summary: stored.summary,
          activity: stored,
        },
      })
    );
    return stored;
  }

  async getActivityHistory(limit: number): Promise<AuditActivity[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": ACTIVITY_PK },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items || [])
      .map((item) => item.activity as AuditActivity | undefined)
      .filter((activity): activity is AuditActivity => Boolean(activity))
      .map((activity) => normalizeActivity({ ...activity, db_mode: "aws-dynamodb" }));
  }

  async incrementDailyCounter(key: string, ttlEpochSeconds: number): Promise<number> {
    // Atomic ADD: concurrent requests cannot race past the cap. The TTL is set
    // only on first write (if_not_exists) so a re-increment never extends it.
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: RATELIMIT_PK, sk: key },
        UpdateExpression: "ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": ttlEpochSeconds },
        ReturnValues: "UPDATED_NEW",
      })
    );
    return Number(result.Attributes?.count ?? 0);
  }
}

// ---------------------------------------------------------------------------
// In-process demo store (no cloud database configured)
// ---------------------------------------------------------------------------
export class MemoryStore implements FinanceStore {
  readonly mode = "embedded-demo" as const;
  private reports: AnalysisReport[] = [];
  private activities: AuditActivity[] = [];
  private counters = new Map<string, number>();

  async persistReport(report: AnalysisReport): Promise<void> {
    this.reports.push(normalizeReport(report));
    if (this.reports.length > 25) this.reports.shift();
  }

  async getLatestReport(): Promise<AnalysisReport | null> {
    return this.reports.length ? normalizeReport(this.reports[this.reports.length - 1]) : null;
  }

  async getReportHistory(limit: number): Promise<AnalysisReport[]> {
    return this.reports.slice(-limit).reverse().map(normalizeReport);
  }

  async persistActivity(record: AuditActivity): Promise<AuditActivity> {
    const stored: AuditActivity = { ...record, db_mode: "embedded-demo" };
    this.activities.push(stored);
    if (this.activities.length > 50) this.activities.shift();
    return stored;
  }

  async getActivityHistory(limit: number): Promise<AuditActivity[]> {
    return this.activities.slice(-limit).reverse().map(normalizeActivity);
  }

  // In-process counter (no cloud DB configured). Resets on cold start; that is
  // an acceptable degradation for the embedded demo — TTL is irrelevant here.
  async incrementDailyCounter(key: string, _ttlEpochSeconds: number): Promise<number> {
    void _ttlEpochSeconds;
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
function dynamoTableName(): string | null {
  return process.env.DYNAMODB_TABLE || process.env.AWS_DYNAMODB_TABLE || null;
}

export function currentDbMode(): AnalysisReport["db_mode"] {
  return dynamoTableName() ? "aws-dynamodb" : "embedded-demo";
}

let cachedStore: FinanceStore | null = null;

export function getStore(): FinanceStore {
  if (cachedStore) return cachedStore;
  const table = dynamoTableName();
  if (table) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1";
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });
    cachedStore = new DynamoStore(table, client);
  } else {
    cachedStore = new MemoryStore();
  }
  return cachedStore;
}
