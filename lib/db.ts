// Data-access layer.
//
// Production: AWS DynamoDB or Amazon Aurora PostgreSQL. Set DYNAMODB_TABLE for
// the fast serverless AWS path, or DATABASE_URL for Aurora PostgreSQL. In both
// modes, the app persists every fused finance-close report and validation result.
//
// Demo: if neither cloud database variable is set, the app runs in
// "embedded-demo" mode — an in-process store — so the full pipeline + dashboard
// work on a laptop with no database.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Pool } from "pg";
import { AnalysisReport, PayrollEvent, ValidationResult } from "./types";

export type DbMode = AnalysisReport["db_mode"];
export type AuditActivityKind = "intake" | "ask";

export interface AuditActivity {
  activity_id: string;
  kind: AuditActivityKind;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  db_mode: DbMode;
}

let pool: Pool | null = null;
let poolInit = false;
let dynamo: DynamoDBDocumentClient | null = null;
let dynamoInit = false;

const REPORT_PK = "REPORT";
const ACTIVITY_PK = "ACTIVITY";

function normalizeReport(report: AnalysisReport): AnalysisReport {
  const legacyReport = report as AnalysisReport & { narrator_model?: string };
  const legacyEngine = legacyReport.narrator_model;
  const existingEngine = report.analysis_engine || legacyEngine || "deterministic-finance-engine";
  const analysisEngine = existingEngine.toLowerCase().startsWith("fallback")
    ? "deterministic-finance-engine"
    : existingEngine;
  const { narrator_model: _legacy, ...cleanReport } = legacyReport;
  void _legacy;
  return {
    ...cleanReport,
    analysis_engine: analysisEngine,
  };
}

function dynamoTableName(): string | null {
  return process.env.DYNAMODB_TABLE || process.env.AWS_DYNAMODB_TABLE || null;
}

function getDynamoClient(): DynamoDBDocumentClient | null {
  if (dynamoInit) return dynamo;
  dynamoInit = true;
  if (!dynamoTableName()) {
    dynamo = null;
    return null;
  }
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1";
  dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return dynamo;
}

function getPool(): Pool | null {
  if (poolInit) return pool;
  poolInit = true;
  const url = process.env.DATABASE_URL;
  if (!url) {
    pool = null;
    return null;
  }
  // Lazy require so the demo path never needs `pg` loaded.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as typeof import("pg");
  const ssl =
    process.env.PGSSLMODE === "disable"
      ? undefined
      : { rejectUnauthorized: false }; // Aurora uses an AWS-managed CA chain
  pool = new PgPool({ connectionString: url, ssl, max: 3 });
  return pool;
}

export function dbMode(): DbMode {
  if (dynamoTableName()) return "aws-dynamodb";
  return process.env.DATABASE_URL ? "aurora-postgres" : "embedded-demo";
}

// In-memory store for demo mode.
const memory: { reports: AnalysisReport[]; activities: AuditActivity[] } = {
  reports: [],
  activities: [],
};

function activityId(kind: AuditActivityKind, createdAt: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${kind}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${suffix}`;
}

function normalizeActivity(activity: AuditActivity): AuditActivity {
  return {
    ...activity,
    summary: activity.summary.slice(0, 240),
  };
}

async function ensureActivityTable(p: Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS audit_activity (
      activity_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      details JSONB NOT NULL,
      db_mode TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_activity_created_at
    ON audit_activity (created_at DESC)
  `);
}

export async function persistReport(report: AnalysisReport): Promise<void> {
  const ddb = getDynamoClient();
  const tableName = dynamoTableName();
  if (ddb && tableName) {
    const stored: AnalysisReport = normalizeReport({ ...report, db_mode: "aws-dynamodb" });
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: REPORT_PK,
          sk: stored.generated_at,
          event_id: stored.event.event_id,
          created_at: stored.generated_at,
          report: stored,
        },
      })
    );
    return;
  }

  const p = getPool();
  if (!p) {
    memory.reports.push(normalizeReport(report));
    if (memory.reports.length > 25) {
      memory.reports.shift();
    }
    return;
  }
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const e = report.event;
    await client.query(
      `INSERT INTO payroll_events
        (event_id, company, period, employee_count, bank_net_total, gross_total,
         employee_ika_total, tax_withheld_total, employer_ika_total, employer_cost_total,
         cost_gap_amount, cost_gap_pct, hidden_total, linked_docs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (event_id) DO UPDATE SET
         employee_count=EXCLUDED.employee_count,
         bank_net_total=EXCLUDED.bank_net_total,
         gross_total=EXCLUDED.gross_total,
         employee_ika_total=EXCLUDED.employee_ika_total,
         tax_withheld_total=EXCLUDED.tax_withheld_total,
         employer_ika_total=EXCLUDED.employer_ika_total,
         employer_cost_total=EXCLUDED.employer_cost_total,
         cost_gap_amount=EXCLUDED.cost_gap_amount,
         cost_gap_pct=EXCLUDED.cost_gap_pct,
         hidden_total=EXCLUDED.hidden_total,
         linked_docs=EXCLUDED.linked_docs,
         created_at=now()`,
      [
        e.event_id, e.company, e.period, e.employee_count, e.bank_net_total, e.gross_total,
        e.employee_ika_total, e.tax_withheld_total, e.employer_ika_total, e.employer_cost_total,
        e.cost_gap_amount, e.cost_gap_pct, e.hidden_total, JSON.stringify(e.linked_docs),
      ]
    );

    await client.query("DELETE FROM employee_payroll WHERE event_id=$1", [e.event_id]);
    for (const emp of e.employees) {
      await client.query(
        `INSERT INTO employee_payroll
          (event_id, employee_id, name, gross, employee_ika, tax, net, employer_ika, employer_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.event_id, emp.employee_id, emp.name, emp.gross, emp.employee_ika, emp.tax, emp.net, emp.employer_ika, emp.employer_cost]
      );
    }

    await client.query("DELETE FROM validation_results WHERE event_id=$1", [e.event_id]);
    for (const v of report.validations) {
      await client.query(
        `INSERT INTO validation_results (event_id, rule, description, passed, detail)
         VALUES ($1,$2,$3,$4,$5)`,
        [e.event_id, v.rule, v.description, v.passed, v.detail]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getLatestReport(): Promise<AnalysisReport | null> {
  const ddb = getDynamoClient();
  const tableName = dynamoTableName();
  if (ddb && tableName) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
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

  const p = getPool();
  if (!p) {
    return memory.reports.length ? normalizeReport(memory.reports[memory.reports.length - 1]) : null;
  }
  const ev = await p.query(`SELECT * FROM payroll_events ORDER BY created_at DESC LIMIT 1`);
  if (ev.rowCount === 0) return null;
  const e = ev.rows[0];
  const emps = await p.query(`SELECT * FROM employee_payroll WHERE event_id=$1 ORDER BY employee_id`, [e.event_id]);
  const vals = await p.query(`SELECT * FROM validation_results WHERE event_id=$1 ORDER BY rule`, [e.event_id]);
  const event: PayrollEvent = {
    event_id: e.event_id,
    company: e.company,
    period: e.period,
    employee_count: e.employee_count,
    bank_net_total: Number(e.bank_net_total),
    gross_total: Number(e.gross_total),
    employer_ika_total: Number(e.employer_ika_total),
    employee_ika_total: Number(e.employee_ika_total),
    tax_withheld_total: Number(e.tax_withheld_total),
    employer_cost_total: Number(e.employer_cost_total),
    cost_gap_amount: Number(e.cost_gap_amount),
    cost_gap_pct: Number(e.cost_gap_pct),
    hidden_total: Number(e.hidden_total),
    employees: emps.rows.map((r) => ({
      employee_id: r.employee_id,
      name: r.name,
      gross: Number(r.gross),
      employee_ika: Number(r.employee_ika),
      tax: Number(r.tax),
      net: Number(r.net),
      employer_ika: Number(r.employer_ika),
      employer_cost: Number(r.employer_cost),
    })),
    linked_docs: e.linked_docs,
  };
  const validations: ValidationResult[] = vals.rows.map((r) => ({
    rule: r.rule,
    description: r.description,
    passed: r.passed,
    detail: r.detail,
  }));
  return normalizeReport({
    event,
    validations,
    executive_summary: "(stored event — re-run analysis to regenerate the narrative)",
    analysis_engine: "deterministic-finance-engine",
    generated_at: e.created_at?.toISOString?.() || new Date().toISOString(),
    db_mode: "aurora-postgres",
  });
}

export async function getReportHistory(limit = 5): Promise<AnalysisReport[]> {
  const safeLimit = Math.max(1, Math.min(limit, 25));
  const ddb = getDynamoClient();
  const tableName = dynamoTableName();
  if (ddb && tableName) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": REPORT_PK },
        ScanIndexForward: false,
        Limit: safeLimit,
      })
    );
    return (result.Items || [])
      .map((item) => item.report as AnalysisReport | undefined)
      .filter((report): report is AnalysisReport => Boolean(report))
      .map((report) => normalizeReport({ ...report, db_mode: "aws-dynamodb" }));
  }

  const p = getPool();
  if (!p) {
    return memory.reports.slice(-safeLimit).reverse().map(normalizeReport);
  }

  const latest = await getLatestReport();
  return latest ? [latest] : [];
}

export async function persistActivity(input: {
  kind: AuditActivityKind;
  summary: string;
  details: Record<string, unknown>;
  activity_id?: string;
  created_at?: string;
}): Promise<AuditActivity> {
  const createdAt = input.created_at || new Date().toISOString();
  const record = normalizeActivity({
    activity_id: input.activity_id || activityId(input.kind, createdAt),
    kind: input.kind,
    summary: input.summary,
    details: input.details,
    created_at: createdAt,
    db_mode: dbMode(),
  });

  const ddb = getDynamoClient();
  const tableName = dynamoTableName();
  if (ddb && tableName) {
    const stored: AuditActivity = { ...record, db_mode: "aws-dynamodb" };
    await ddb.send(
      new PutCommand({
        TableName: tableName,
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

  const p = getPool();
  if (!p) {
    memory.activities.push(record);
    if (memory.activities.length > 50) {
      memory.activities.shift();
    }
    return record;
  }

  const stored: AuditActivity = { ...record, db_mode: "aurora-postgres" };
  await ensureActivityTable(p);
  await p.query(
    `INSERT INTO audit_activity (activity_id, kind, summary, details, db_mode, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (activity_id) DO UPDATE SET
       kind=EXCLUDED.kind,
       summary=EXCLUDED.summary,
       details=EXCLUDED.details,
       db_mode=EXCLUDED.db_mode,
       created_at=EXCLUDED.created_at`,
    [
      stored.activity_id,
      stored.kind,
      stored.summary,
      JSON.stringify(stored.details),
      stored.db_mode,
      stored.created_at,
    ]
  );
  return stored;
}

export async function getActivityHistory(limit = 10): Promise<AuditActivity[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const ddb = getDynamoClient();
  const tableName = dynamoTableName();
  if (ddb && tableName) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": ACTIVITY_PK },
        ScanIndexForward: false,
        Limit: safeLimit,
      })
    );
    return (result.Items || [])
      .map((item) => item.activity as AuditActivity | undefined)
      .filter((activity): activity is AuditActivity => Boolean(activity))
      .map((activity) => normalizeActivity({ ...activity, db_mode: "aws-dynamodb" }));
  }

  const p = getPool();
  if (!p) {
    return memory.activities.slice(-safeLimit).reverse().map(normalizeActivity);
  }

  await ensureActivityTable(p);
  const rows = await p.query(
    `SELECT activity_id, kind, summary, details, db_mode, created_at
     FROM audit_activity
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return rows.rows.map((row) =>
    normalizeActivity({
      activity_id: row.activity_id,
      kind: row.kind,
      summary: row.summary,
      details: row.details,
      db_mode: row.db_mode,
      created_at: row.created_at?.toISOString?.() || String(row.created_at),
    })
  );
}
