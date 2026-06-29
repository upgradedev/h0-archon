"use client";

import { useState } from "react";
import type { ExtractedDocument } from "@/lib/types";
import { ACCURACY_TABLE, SAMPLE_CASE, type ExtractApiResponse } from "./data";
import { UploadDropzone } from "./UploadDropzone";

const FIELD_LABELS: Record<string, string> = {
  bank_net_total: "Bank net total",
  gross_total: "Gross total",
  employee_ika_total: "Employee social-security",
  tax_withheld_total: "Tax withheld",
  employer_ika_total: "Employer social-security",
  employer_cost_total: "Employer cost total",
  invoice_number: "Invoice number",
  invoice_date: "Invoice date",
  counterparty: "Counterparty",
  net_amount: "Net amount",
  vat_amount: "VAT amount",
  gross_amount: "Gross (incl. VAT)",
  payment_date: "Payment date",
  "employee.gross": "Gross",
  "employee.employee_ika": "Employee social-security",
  "employee.tax": "Tax",
  "employee.net": "Net",
  "employee.employer_ika": "Employer social-security",
  "employee.employer_cost": "Employer cost",
};

function fmt(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v;
}

function fieldLabel(f: string): string {
  return FIELD_LABELS[f] ?? f;
}

export function ExtractClient() {
  const [file, setFile] = useState(SAMPLE_CASE.docs[0].file);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file }),
      });
      const data = (await res.json()) as ExtractApiResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `request failed (${res.status})`);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "network error");
    } finally {
      setBusy(false);
    }
  }

  const selected = SAMPLE_CASE.docs.find((d) => d.file === file);

  return (
    <div className="extract">
      <header className="extract-head">
        <h1>Live document extraction</h1>
        <p>
          Pick a real sample document. Archon rasterizes the PDF and sends the
          pages to <strong>AWS Bedrock vision</strong> (Claude Sonnet 4.6), then
          scores the structured result against ground truth. No competitor lets
          you watch the AI read a document — this does.
        </p>
      </header>

      <UploadDropzone />

      <section className="panel extract-picker">
        <div className="section-title">
          <h3>2 · Or choose a curated sample</h3>
          <span className="tag">{SAMPLE_CASE.company}</span>
        </div>
        <div className="doc-options">
          {SAMPLE_CASE.docs.map((d) => (
            <label key={d.file} className={`doc-option${file === d.file ? " active" : ""}`}>
              <input
                type="radio"
                name="sample-doc"
                value={d.file}
                checked={file === d.file}
                onChange={() => setFile(d.file)}
              />
              <span className="doc-option-body">
                <strong>{d.label}</strong>
                <span className="doc-type-pill">{d.docType}</span>
                <span className="doc-hint">{d.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="extract-actions">
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? "Extracting…" : "Run extraction"}
          </button>
          <span className="status">
            {selected ? `Source: ${selected.file}` : ""}
          </span>
        </div>
      </section>

      {error && (
        <section className="panel">
          <p className="fail">Error: {error}</p>
        </section>
      )}

      {result && (
        <>
          <section className={`panel mode-banner ${result.mode}`}>
            <div className="section-title">
              <h3>
                {result.mode === "live"
                  ? "3 · Live Bedrock extraction"
                  : "3 · Cached example (configure to run live)"}
              </h3>
              <span className={`tag ${result.mode}`}>
                {result.mode === "live" ? "LIVE · AWS Bedrock" : "CACHED"}
              </span>
            </div>
            {result.reason && <p className="status">{result.reason}</p>}
            <div className="run-meta">
              <span>
                Model <code>{result.modelId}</code>
              </span>
              <span>
                Region <code>{result.region}</code>
              </span>
              {result.confidence !== null && (
                <span>Confidence {(result.confidence * 100).toFixed(0)}%</span>
              )}
              {result.tokens && (
                <span>
                  Tokens {result.tokens.input} in / {result.tokens.output} out
                </span>
              )}
            </div>
            {result.flags.length > 0 && (
              <ul className="flag-list">
                {result.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid two-col">
            <section className="panel">
              <div className="section-title">
                <h3>Structured result</h3>
                <span className="doc-type-pill">{result.document.doc_type}</span>
              </div>
              <DocFields doc={result.document} />
            </section>

            <section className="panel">
              <div className="section-title">
                <h3>Field accuracy vs ground truth</h3>
                {result.score && (
                  <span
                    className={`tag ${result.score.accuracy >= 0.999 ? "good" : ""}`}
                  >
                    {result.score.correct}/{result.score.total} ·{" "}
                    {(result.score.accuracy * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {result.score ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th className="num">Expected</th>
                      <th className="num">Extracted</th>
                      <th>OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>doc_type</td>
                      <td className="num">{result.score.classificationExpected}</td>
                      <td className="num">{result.score.classificationActual}</td>
                      <td className={result.score.classificationMatch ? "pass" : "fail"}>
                        {result.score.classificationMatch ? "✓" : "✗"}
                      </td>
                    </tr>
                    {result.score.fields.map((c) => (
                      <tr key={c.field}>
                        <td>{fieldLabel(c.field)}</td>
                        <td className="num">{fmt(c.expected)}</td>
                        <td className="num">{fmt(c.actual)}</td>
                        <td className={c.match ? "pass" : "fail"}>
                          {c.match ? "✓" : "✗"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="status">No ground truth for this document.</p>
              )}
            </section>
          </div>
        </>
      )}

      <section className="panel">
        <div className="section-title">
          <h3>Measured accuracy — real Bedrock vision</h3>
          <span className="tag">
            {(ACCURACY_TABLE.overallFieldAccuracy * 100).toFixed(1)}% overall
          </span>
        </div>
        <p className="status">
          From <code>eval/LIVE_EXTRACTION.md</code> · {ACCURACY_TABLE.model} ·{" "}
          {ACCURACY_TABLE.region} · {ACCURACY_TABLE.date}
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Doc type</th>
              <th>Classification</th>
              <th>Field accuracy</th>
            </tr>
          </thead>
          <tbody>
            {ACCURACY_TABLE.rows.map((r) => (
              <tr key={r.docType}>
                <td>{r.docType}</td>
                <td>{r.classification}</td>
                <td>{r.fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DocFields({ doc }: { doc: ExtractedDocument }) {
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Company", doc.company],
    ["Period", doc.period],
    ["Payment date", doc.payment_date],
    ["Bank net total", doc.bank_net_total],
    ["Gross total", doc.gross_total],
    ["Employee social-security", doc.employee_ika_total],
    ["Tax withheld", doc.tax_withheld_total],
    ["Employer social-security", doc.employer_ika_total],
    ["Employer cost total", doc.employer_cost_total],
    ["Register headcount", doc.register_employee_count],
    ["Invoice number", doc.invoice_number],
    ["Invoice date", doc.invoice_date],
    ["Counterparty", doc.counterparty],
    ["Net amount", doc.net_amount],
    ["VAT amount", doc.vat_amount],
    ["VAT rate %", doc.vat_rate],
    ["Gross (incl. VAT)", doc.gross_amount],
  ];
  const present = rows.filter(([, v]) => v !== null && v !== undefined);
  return (
    <>
      <div className="pnl-list">
        {present.map(([k, v]) => (
          <div className="pnl-row" key={k}>
            <span>{k}</span>
            <strong>{fmt((v ?? null) as string | number | null)}</strong>
          </div>
        ))}
      </div>
      {doc.employee && (
        <div className="employee-card">
          <strong>{doc.employee.name}</strong> · {doc.employee.employee_id}
          <div className="pnl-list">
            <div className="pnl-row">
              <span>Gross</span>
              <strong>{fmt(doc.employee.gross)}</strong>
            </div>
            <div className="pnl-row">
              <span>Employee social-security</span>
              <strong>{fmt(doc.employee.employee_ika)}</strong>
            </div>
            <div className="pnl-row">
              <span>Tax</span>
              <strong>{fmt(doc.employee.tax)}</strong>
            </div>
            <div className="pnl-row">
              <span>Net</span>
              <strong>{fmt(doc.employee.net)}</strong>
            </div>
            <div className="pnl-row">
              <span>Employer social-security</span>
              <strong>{fmt(doc.employee.employer_ika)}</strong>
            </div>
            <div className="pnl-row">
              <span>Employer cost</span>
              <strong>{fmt(doc.employee.employer_cost)}</strong>
            </div>
          </div>
        </div>
      )}
      {doc.line_items && doc.line_items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Line item</th>
              <th className="num">Qty</th>
              <th className="num">Unit</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.line_items.map((li, i) => (
              <tr key={i}>
                <td>{li.description || "—"}</td>
                <td className="num">{fmt(li.quantity ?? null)}</td>
                <td className="num">{fmt(li.unit_price ?? null)}</td>
                <td className="num">{fmt(li.amount ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
