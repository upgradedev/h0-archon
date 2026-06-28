// Persistence layer.
//
// One `FinanceStore` interface, selected once by environment:
//   - DynamoStore  : AWS DynamoDB (fast serverless path, DYNAMODB_TABLE)
//   - AuroraStore  : Amazon Aurora PostgreSQL (DATABASE_URL)
//   - MemoryStore  : in-process demo store (no cloud database configured)
//
// The DynamoDB client is injected into DynamoStore so the production read/write
// command shapes can be unit-tested without live AWS credentials.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Pool } from "pg";
import type { AnalysisReport, AuditActivity, PayrollEvent, ValidationResult } from "./types";
import { normalizeActivity, normalizeReport } from "./normalize";

const REPORT_PK = "REPORT";
const ACTIVITY_PK = "ACTIVITY";

export interface FinanceStore {
  readonly mode: AnalysisReport["db_mode"];
  persistReport(report: AnalysisReport): Promise<void>;
  getLatestReport(): Promise<AnalysisReport | null>;
  getReportHistory(limit: number): Promise<AnalysisReport[]>;
  persistActivity(record: AuditActivity): Promise<AuditActivity>;
  getActivityHistory(limit: number): Promise<AuditActivity[]>;
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
}

// ---------------------------------------------------------------------------
// Amazon Aurora PostgreSQL store
// ---------------------------------------------------------------------------
export class AuroraStore implements FinanceStore {
  readonly mode = "aurora-postgres" as const;
  private pool: Pool;

  constructor(connectionString: string) {
    // Lazy require so the non-Aurora paths never need `pg` loaded.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool: PgPool } = require("pg") as typeof import("pg");
    const ssl =
      process.env.PGSSLMODE === "disable"
        ? undefined
        : { rejectUnauthorized: false }; // Aurora uses an AWS-managed CA chain
    this.pool = new PgPool({ connectionString, ssl, max: 3 });
  }

  private async ensureActivityTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_activity (
        activity_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        details JSONB NOT NULL,
        db_mode TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_activity_created_at
      ON audit_activity (created_at DESC)
    `);
  }

  async persistReport(report: AnalysisReport): Promise<void> {
    const client = await this.pool.connect();
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

  async getLatestReport(): Promise<AnalysisReport | null> {
    const ev = await this.pool.query(`SELECT * FROM payroll_events ORDER BY created_at DESC LIMIT 1`);
    if (ev.rowCount === 0) return null;
    const e = ev.rows[0];
    const emps = await this.pool.query(`SELECT * FROM employee_payroll WHERE event_id=$1 ORDER BY employee_id`, [e.event_id]);
    const vals = await this.pool.query(`SELECT * FROM validation_results WHERE event_id=$1 ORDER BY rule`, [e.event_id]);
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

  async getReportHistory(_limit: number): Promise<AnalysisReport[]> {
    void _limit;
    const latest = await this.getLatestReport();
    return latest ? [latest] : [];
  }

  async persistActivity(record: AuditActivity): Promise<AuditActivity> {
    const stored: AuditActivity = { ...record, db_mode: "aurora-postgres" };
    await this.ensureActivityTable();
    await this.pool.query(
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

  async getActivityHistory(limit: number): Promise<AuditActivity[]> {
    await this.ensureActivityTable();
    const rows = await this.pool.query(
      `SELECT activity_id, kind, summary, details, db_mode, created_at
       FROM audit_activity
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
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
}

// ---------------------------------------------------------------------------
// In-process demo store (no cloud database configured)
// ---------------------------------------------------------------------------
export class MemoryStore implements FinanceStore {
  readonly mode = "embedded-demo" as const;
  private reports: AnalysisReport[] = [];
  private activities: AuditActivity[] = [];

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
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
function dynamoTableName(): string | null {
  return process.env.DYNAMODB_TABLE || process.env.AWS_DYNAMODB_TABLE || null;
}

export function currentDbMode(): AnalysisReport["db_mode"] {
  if (dynamoTableName()) return "aws-dynamodb";
  return process.env.DATABASE_URL ? "aurora-postgres" : "embedded-demo";
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
  } else if (process.env.DATABASE_URL) {
    cachedStore = new AuroraStore(process.env.DATABASE_URL);
  } else {
    cachedStore = new MemoryStore();
  }
  return cachedStore;
}
