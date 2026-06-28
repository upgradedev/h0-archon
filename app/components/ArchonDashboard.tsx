"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBusinessIntelligence } from "@/lib/business";
import {
  analysisEngineLabel,
  buildCashPlanningInsight,
  buildDocumentSources,
  buildJudgeEvidence,
  buildWorkflowSteps,
} from "@/lib/insights";
import type { AnalysisReport } from "@/lib/types";

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
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [salesLift, setSalesLift] = useState(5);

  const chartData = useMemo(
    () => [
      {
        name: "Revenue",
        amount: buildBusinessIntelligence(report).pnl.revenue,
      },
      {
        name: "Gross profit",
        amount: buildBusinessIntelligence(report).pnl.grossProfit,
      },
      {
        name: "EBITDA",
        amount: buildBusinessIntelligence(report).pnl.ebitda,
      },
    ],
    [report]
  );
  const chartMax = Math.max(...chartData.map((item) => item.amount), 1);
  const business = useMemo(() => buildBusinessIntelligence(report), [report]);
  const documents = useMemo(() => buildDocumentSources(report), [report]);
  const workflow = useMemo(() => buildWorkflowSteps(report), [report]);
  const cashPlan = useMemo(() => buildCashPlanningInsight(report), [report]);
  const evidence = useMemo(() => buildJudgeEvidence(report), [report]);
  const engineLabel = analysisEngineLabel(report);
  const passCount = report.validations.filter((check) => check.passed).length;
  const projectedRevenue = business.pnl.revenue * (1 + salesLift / 100);
  const projectedEbitda = business.pnl.ebitda + (projectedRevenue - business.pnl.revenue) * (business.sales.weightedMarginPct / 100);
  const projectedCash = business.cash.closingBalance + (projectedEbitda - business.pnl.ebitda);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/history?limit=5", { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { reports?: AnalysisReport[] };
      setHistory(body.reports || []);
    } catch {
      setHistory([]);
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
          <div className="pill">Aurora PostgreSQL fallback via DATABASE_URL</div>
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
              <span className="tag">Typed Handoff</span>
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
        </section>
      </main>
    </div>
  );
}
