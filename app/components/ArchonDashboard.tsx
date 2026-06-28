"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  const [newHires, setNewHires] = useState(1);

  const chartData = useMemo(
    () => [
      {
        name: "Bank view",
        amount: report.event.bank_net_total,
      },
      {
        name: "True cost",
        amount: report.event.employer_cost_total,
      },
      {
        name: "Hidden wedge",
        amount: report.event.hidden_total,
      },
    ],
    [report]
  );
  const chartMax = Math.max(...chartData.map((item) => item.amount), 1);
  const documents = useMemo(() => buildDocumentSources(report), [report]);
  const workflow = useMemo(() => buildWorkflowSteps(report), [report]);
  const cashPlan = useMemo(() => buildCashPlanningInsight(report), [report]);
  const evidence = useMemo(() => buildJudgeEvidence(report), [report]);
  const passCount = report.validations.filter((check) => check.passed).length;
  const projectedMonthlyCost = report.event.employer_cost_total + cashPlan.averageEmployerCostPerEmployee * newHires;
  const projectedUnderstatement = projectedMonthlyCost - report.event.bank_net_total;

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
    setStatus("Running extractor -> linker -> validator -> narrator -> AWS persistence");
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
          Agentic payroll reconciliation for SMB finance, shaped for the H0
          Vercel + AWS database challenge.
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
          <div className="pill">Gemini narrator with deterministic fallback</div>
          <div className="pill">28% payroll-cost gap surfaced explicitly</div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <h2>{report.event.company} Payroll Intelligence</h2>
            <p>
              Period {report.event.period} - {report.event.employee_count} employees - {report.db_mode}
            </p>
          </div>
          <div className="actions">
            <button className="primary" onClick={run} disabled={busy}>
              {busy ? "Running..." : "Run Pipeline"}
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
            <p className="label">Bank Confirmation</p>
            <p className="value">{eur.format(report.event.bank_net_total)}</p>
            <p className="delta">Visible salary transfer only.</p>
          </section>
          <section className="panel metric">
            <p className="label">True Employer Cost</p>
            <p className="value">{eur.format(report.event.employer_cost_total)}</p>
            <p className="delta">Gross payroll plus employer IKA.</p>
          </section>
          <section className="panel metric">
            <p className="label">Hidden Wedge</p>
            <p className="value">{eur.format(report.event.hidden_total)}</p>
            <p className="delta">Understatement versus bank-only accounting.</p>
          </section>
          <section className="panel metric">
            <p className="label">Employer IKA Gap</p>
            <p className="value">{report.event.cost_gap_pct.toFixed(1)}%</p>
            <p className="delta">Employer contribution as a share of bank net.</p>
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
              <h3>Bank View vs Fused Payroll Truth</h3>
              <span className="tag">Validated Event</span>
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
          </section>
          <section className="panel">
            <div className="section-title">
              <h3>Executive Summary</h3>
              <span className="tag">{report.narrator_model}</span>
            </div>
            <p className="summary">{report.executive_summary}</p>
            <p className="status">{status}</p>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Source Documents</h3>
              <span className="tag">{report.event.linked_docs.length} linked</span>
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
          <section className="panel">
            <div className="section-title">
              <h3>Scenario Planner</h3>
              <span className="tag">Cash Impact</span>
            </div>
            <div className="scenario">
              <label htmlFor="new-hires">New hires this month</label>
              <div className="range-row">
                <input
                  id="new-hires"
                  type="range"
                  min="0"
                  max="5"
                  value={newHires}
                  onChange={(event) => setNewHires(Number(event.target.value))}
                />
                <strong>{newHires}</strong>
              </div>
              <div className="scenario-grid">
                <div>
                  <span>True monthly cost</span>
                  <strong>{eur.format(projectedMonthlyCost)}</strong>
                </div>
                <div>
                  <span>Bank-only understatement</span>
                  <strong>{eur.format(projectedUnderstatement)}</strong>
                </div>
                <div>
                  <span>3 month reserve target</span>
                  <strong>{eur.format(cashPlan.quarterlyReserveTarget)}</strong>
                </div>
                <div>
                  <span>Annual hidden amount</span>
                  <strong>{eur.format(cashPlan.annualUnderstatement)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid two-col" style={{ marginTop: 16 }}>
          <section className="panel">
            <div className="section-title">
              <h3>Employee Payroll Detail</h3>
            </div>
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
                <strong>{eur.format(item.event.employer_cost_total)}</strong>
                <span>{item.db_mode}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
