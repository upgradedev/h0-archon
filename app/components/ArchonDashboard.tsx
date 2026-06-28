"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBusinessIntelligence } from "@/lib/business";
import {
  analysisEngineLabel,
  buildAccountingCitations,
  buildCashPlanningInsight,
  buildDocumentSources,
  buildJudgeEvidence,
  buildWorkflowSteps,
} from "@/lib/insights";
import type { AuditActivity } from "@/lib/db";
import type { IntakeResponse } from "@/lib/intake";
import type { FinanceAnswer } from "@/lib/qa";
import type { AnalysisReport } from "@/lib/types";

type PersistedIntakeResponse = IntakeResponse & { activity_id?: string; persisted_via?: string };
type PersistedFinanceAnswer = FinanceAnswer & { activity_id?: string; persisted_via?: string };

const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function ArchonDashboard({ initialReport }: { initialReport: AnalysisReport }) {
  const [report, setReport] = useState(initialReport);
  const [history, setHistory] = useState<AnalysisReport[]>([]);
  const [activity, setActivity] = useState<AuditActivity[]>([]);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [salesLift, setSalesLift] = useState(5);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [question, setQuestion] = useState("What is our true payroll cost, and how does it compare to the bank statement?");
  const [answer, setAnswer] = useState<FinanceAnswer | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  const business = useMemo(() => buildBusinessIntelligence(report), [report]);
  const chartData = useMemo(
    () => [
      {
        name: "Revenue",
        amount: business.pnl.revenue,
      },
      {
        name: "Gross profit",
        amount: business.pnl.grossProfit,
      },
      {
        name: "EBITDA",
        amount: business.pnl.ebitda,
      },
    ],
    [business]
  );
  const chartMax = Math.max(...chartData.map((item) => item.amount), 1);
  const documents = useMemo(() => buildDocumentSources(report), [report]);
  const workflow = useMemo(() => buildWorkflowSteps(report), [report]);
  const cashPlan = useMemo(() => buildCashPlanningInsight(report), [report]);
  const evidence = useMemo(() => buildJudgeEvidence(report), [report]);
  const citations = useMemo(() => buildAccountingCitations(report), [report]);
  const engineLabel = analysisEngineLabel(report);
  const passCount = report.validations.filter((check) => check.passed).length;
  const projectedRevenue = business.pnl.revenue * (1 + salesLift / 100);
  const projectedEbitda = business.pnl.ebitda + (projectedRevenue - business.pnl.revenue) * (business.sales.weightedMarginPct / 100);
  const projectedCash = business.cash.closingBalance + (projectedEbitda - business.pnl.ebitda);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/history?limit=5&activity_limit=8", { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { reports?: AnalysisReport[]; activity?: AuditActivity[] };
      setHistory(body.reports || []);
      setActivity(body.activity || []);
    } catch {
      setHistory([]);
      setActivity([]);
    }
  }

  useEffect(() => {
    refreshHistory();
  }, []);

  async function run() {
    setBusy(true);
    setStatus("Running finance ingestion -> ledger reconciliation -> controls -> AWS persistence");
    try {
      const res = await fetch("/api/run", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const next = (await res.json()) as AnalysisReport;
      setReport(next);
      setStatus(`Completed at ${formatDate(next.generated_at)} via ${next.db_mode}`);
      await refreshHistory();
    } catch (err) {
      setStatus(`Run failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function queueDocuments() {
    setIntakeBusy(true);
    setStatus("Classifying uploaded finance documents");
    try {
      const form = new FormData();
      selectedFiles.forEach((file) => form.append("files", file));
      const res = await fetch("/api/intake", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const next = (await res.json()) as PersistedIntakeResponse;
      setIntake(next);
      setStatus(`${next.accepted}/${next.received} documents classified; coverage: ${next.coverage.join(", ") || "manual review"}; persisted via ${next.persisted_via || "runtime"}`);
      await refreshHistory();
    } catch (err) {
      setStatus(`Intake failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIntakeBusy(false);
    }
  }

  async function askReport() {
    setAskBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAnswer((await res.json()) as PersistedFinanceAnswer);
      await refreshHistory();
    } catch (err) {
      setAnswer({
        question,
        answer: `Question failed: ${err instanceof Error ? err.message : String(err)}`,
        sources: [],
        generated_at: new Date().toISOString(),
      });
    } finally {
      setAskBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <h1>Archon H0</h1>
            <p>Vercel + AWS</p>
          </div>
        </div>
        <p className="side-note">
          Agentic SMB finance intelligence for the H0 Vercel + AWS database
          challenge: P&L, cash, sales goals, purchases, and payroll controls.
        </p>
        <div className="side-kpis">
          <div>
            <span>Control pass rate</span>
            <strong>{passCount}/{report.validations.length}</strong>
          </div>
          <div>
            <span>Persisted through</span>
            <strong>{report.db_mode}</strong>
          </div>
        </div>
        <div className="side-stack">
          <div className="pill">Next.js on Vercel</div>
          <div className="pill">AWS DynamoDB via DYNAMODB_TABLE</div>
          <div className="pill">Deterministic CFO analysis engine</div>
          <div className="pill">Sales, purchases, cash, P&L, payroll controls</div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <h2>{report.event.company} Finance Intelligence</h2>
            <p>
              Period {report.event.period} - {report.event.employee_count} employees - {report.db_mode}
            </p>
          </div>
          <div className="actions">
            <button className="primary" onClick={run} disabled={busy}>
              {busy ? "Running..." : "Run Finance Close"}
            </button>
            <a className="secondary" href="/api/report">
              API JSON
            </a>
            <a className="secondary" href="/api/evidence">
              Evidence
            </a>
          </div>
        </div>

        <div className="grid metrics">
          <section className="panel metric">
            <p className="label">Net Revenue</p>
            <p className="value">{eur.format(business.pnl.revenue)}</p>
            <p className="delta">Invoices, POS, and e-commerce settlements.</p>
          </section>
          <section className="panel metric">
            <p className="label">EBITDA</p>
            <p className="value">{eur.format(business.pnl.ebitda)}</p>
            <p className="delta">{business.pnl.ebitdaMarginPct.toFixed(1)}% after full payroll cost.</p>
          </section>
          <section className="panel metric">
            <p className="label">Closing Cash</p>
            <p className="value">{eur.format(business.cash.closingBalance)}</p>
            <p className="delta">{business.cash.runwayMonths.toFixed(1)} months operating runway.</p>
          </section>
          <section className="panel metric">
            <p className="label">Sales Goal</p>
            <p className="value">{business.sales.attainmentPct.toFixed(1)}%</p>
            <p className="delta">{eur.format(business.sales.actual)} of {eur.format(business.sales.goal)} target.</p>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Agent Run Ledger</h3>
              <span className="tag">Seven Agents</span>
            </div>
            <div className="timeline">
              {workflow.map((step, index) => (
                <div className="timeline-row" key={step.id}>
                  <div className={`step-index ${step.status}`}>{index + 1}</div>
                  <div>
                    <div className="row-head">
                      <strong>{step.title}</strong>
                      <span>{step.owner}</span>
                    </div>
                    <p>{step.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Vercel + AWS Evidence</h3>
              <span className="tag">Judge Proof</span>
            </div>
            <div className="evidence-list">
              {evidence.stack.map((item) => (
                <div className="evidence-row" key={item.label}>
                  <span className={`dot ${item.status}`} />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="proof-line">
              {evidence.proof.map((item) => (
                <code key={item}>{item}</code>
              ))}
            </div>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Document Intake</h3>
              <span className="tag">{intake?.ready_for_close ? "Close Ready" : "Upload Queue"}</span>
            </div>
            <div className="intake-box">
              <input
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files || []))}
              />
              <button className="secondary" onClick={queueDocuments} disabled={intakeBusy || selectedFiles.length === 0}>
                {intakeBusy ? "Classifying..." : "Classify Files"}
              </button>
            </div>
            <div className="intake-list">
              {(intake?.files || selectedFiles.map((file) => ({ name: file.name, size: file.size, kind: "queued", role: "Ready to classify", confidence: 0 }))).map((file) => (
                <div className="intake-row" key={`${file.name}-${file.size}`}>
                  <div>
                    <strong>{file.name}</strong>
                    <span>{file.role}</span>
                  </div>
                  <code>{file.kind}{file.confidence ? ` ${(file.confidence * 100).toFixed(0)}%` : ""}</code>
                </div>
              ))}
              {!selectedFiles.length && !intake && (
                <div className="intake-row muted-row">
                  <div>
                    <strong>Demo bundle ready</strong>
                    <span>Bank, sales, purchases, payroll register, and payslips are represented in the current close.</span>
                  </div>
                  <code>sample</code>
                </div>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Ask Archon</h3>
              <span className="tag">Source Backed</span>
            </div>
            <div className="ask-box">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
              />
              <button className="primary" onClick={askReport} disabled={askBusy}>
                {askBusy ? "Answering..." : "Ask Report"}
              </button>
            </div>
            {answer && (
              <div className="answer-box">
                <p>{answer.answer}</p>
                <div className="citation-list compact">
                  {answer.sources.slice(0, 4).map((source) => (
                    <div className="citation-row" key={source.id}>
                      <strong>{source.id}</strong>
                      <span>{source.evidence}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>P&L Snapshot</h3>
              <span className="tag">{business.pnl.grossMarginPct.toFixed(1)}% gross margin</span>
            </div>
            <div className="bar-chart">
              {chartData.map((item) => (
                <div className="bar-row" key={item.name}>
                  <div className="bar-label">{item.name}</div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(7, (item.amount / chartMax) * 100)}%` }}
                    />
                  </div>
                  <div className="bar-value">{eur.format(item.amount)}</div>
                </div>
              ))}
            </div>
            <div className="pnl-list">
              {business.pnl.lines.map((line) => (
                <div className="pnl-row" key={line.label}>
                  <span>{line.label}</span>
                  <strong className={line.amount < 0 ? "outflow" : ""}>{eur.format(line.amount)}</strong>
                  <p>{line.note}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>CFO Brief</h3>
              <span className="tag">{engineLabel}</span>
            </div>
            <p className="summary">{business.brief}</p>
            <div className="alert-list">
              {business.alerts.map((alert) => (
                <div className={`alert-row ${alert.severity}`} key={alert.title}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              ))}
            </div>
            <div className="citation-list">
              {citations.map((citation) => (
                <div className="citation-row" key={citation.id}>
                  <strong>{citation.id}</strong>
                  <span>{citation.claim}</span>
                </div>
              ))}
            </div>
            <p className="status">{status}</p>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Account Statement</h3>
              <span className="tag">Bank Reconciled</span>
            </div>
            <div className="statement-list">
              {business.cash.movements.map((movement) => (
                <div className="statement-row" key={movement.label}>
                  <span>{movement.label}</span>
                  <strong className={movement.direction === "out" ? "outflow" : ""}>
                    {movement.direction === "out" ? "-" : ""}{eur.format(movement.amount)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="working-capital">
              <div><span>Receivables</span><strong>{eur.format(business.workingCapital.receivables)}</strong></div>
              <div><span>Payables</span><strong>{eur.format(business.workingCapital.payables)}</strong></div>
              <div><span>VAT payable</span><strong>{eur.format(business.workingCapital.vatPayable)}</strong></div>
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Sales Performance</h3>
              <span className="tag">{business.sales.attainmentPct.toFixed(1)}% goal</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Segment</th>
                  <th className="num">Actual</th>
                  <th className="num">Goal</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {business.sales.performance.map((seller) => (
                  <tr key={seller.owner}>
                    <td>{seller.owner}</td>
                    <td>{seller.segment}</td>
                    <td className="num">{eur.format(seller.actual)}</td>
                    <td className="num">{eur.format(seller.goal)}</td>
                    <td className="num">{seller.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Purchase Concentration</h3>
              <span className="tag">{eur.format(business.purchases.total)} COGS</span>
            </div>
            <div className="purchase-list">
              {business.purchases.categories.map((purchase) => (
                <div className="purchase-row" key={purchase.category}>
                  <div>
                    <strong>{purchase.category}</strong>
                    <p>{purchase.vendor}</p>
                  </div>
                  <div className="purchase-bar">
                    <div style={{ width: `${purchase.sharePct}%` }} />
                  </div>
                  <span className={`risk ${purchase.risk}`}>{purchase.sharePct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Source Documents</h3>
              <span className="tag">{report.event.linked_docs.length + 4} linked</span>
            </div>
            <div className="source-list">
              {documents.map((doc) => (
                <div className="source-row" key={doc.id}>
                  <div>
                    <strong>{doc.title}</strong>
                    <p>{doc.role}</p>
                  </div>
                  <div className="source-meta">
                    <code>{doc.filename}</code>
                    <span>{doc.captured}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Goal Scenario</h3>
              <span className="tag">Sales + Cash</span>
            </div>
            <div className="scenario">
              <label htmlFor="sales-lift">Additional sales conversion</label>
              <div className="range-row">
                <input
                  id="sales-lift"
                  type="range"
                  min="0"
                  max="20"
                  value={salesLift}
                  onChange={(event) => setSalesLift(Number(event.target.value))}
                />
                <strong>{salesLift}%</strong>
              </div>
              <div className="scenario-grid">
                <div>
                  <span>Projected revenue</span>
                  <strong>{eur.format(projectedRevenue)}</strong>
                </div>
                <div>
                  <span>Projected EBITDA</span>
                  <strong>{eur.format(projectedEbitda)}</strong>
                </div>
                <div>
                  <span>3 month payroll reserve</span>
                  <strong>{eur.format(cashPlan.quarterlyReserveTarget)}</strong>
                </div>
                <div>
                  <span>Projected closing cash</span>
                  <strong>{eur.format(projectedCash)}</strong>
                </div>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Payroll Control Finding</h3>
              <span className="tag">{report.event.cost_gap_pct.toFixed(1)}% gap</span>
            </div>
            <p className="summary compact">
              The payroll module remains an important finding, but it is now one
              part of the full finance close. Bank-only payroll understates true
              employer cost by {eur.format(report.event.hidden_total)} this month.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Net</th>
                  <th className="num">Gross</th>
                  <th className="num">Employer Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.event.employees.map((employee) => (
                  <tr key={employee.employee_id}>
                    <td>{employee.name}</td>
                    <td className="num">{eur.format(employee.net)}</td>
                    <td className="num">{eur.format(employee.gross)}</td>
                    <td className="num">{eur.format(employee.employer_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Validation Checks</h3>
            </div>
            <div className="checks">
              {report.validations.map((check) => (
                <div className="check" key={check.rule}>
                  <strong className={check.passed ? "pass" : "fail"}>
                    {check.rule} {check.passed ? "PASS" : "FAIL"}
                  </strong>
                  {check.description}
                  <div className="status">{check.detail}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel history-panel">
          <div className="section-title">
            <h3>Recent Runs</h3>
            <a className="text-link" href="/api/history">History API</a>
          </div>
          <div className="history-list">
            {(history.length ? history : [report]).map((item) => (
              <div className="history-row" key={`${item.event.event_id}-${item.generated_at}`}>
                <code>{item.generated_at}</code>
                <span>{item.event.company} {item.event.period}</span>
                <strong>{eur.format(buildBusinessIntelligence(item).pnl.revenue)}</strong>
                <span>{item.db_mode}</span>
              </div>
            ))}
          </div>
          <div className="activity-title">
            <h4>Persisted Activity</h4>
            <span>{activity.length ? `${activity.length} records` : "no interaction records yet"}</span>
          </div>
          <div className="activity-list">
            {(activity.length ? activity : [
              {
                activity_id: "pending-demo",
                kind: "intake" as const,
                summary: "Run intake or Ask Archon to create an ACTIVITY record.",
                details: {},
                created_at: report.generated_at,
                db_mode: report.db_mode,
              },
            ]).map((item) => (
              <div className="activity-row" key={item.activity_id}>
                <code>{item.kind}</code>
                <span>{formatDate(item.created_at)}</span>
                <strong>{item.summary}</strong>
                <span>{item.db_mode}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
