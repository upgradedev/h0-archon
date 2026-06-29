"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { track } from "@vercel/analytics";
import type { DocType, ExtractedDocument } from "@/lib/types";
import { MAX_UPLOAD_BYTES, UPLOAD_DAILY_LIMIT } from "@/lib/upload";

// Response shape from POST /api/upload (success). Mirrors the route.
interface UploadOk {
  mode: "live";
  modelId: string;
  region: string;
  filename: string;
  docType: DocType;
  document: ExtractedDocument;
  confidence: number;
  flags: string[];
  tokens: { input: number; output: number };
}

type CardState =
  | { status: "reading" }
  | { status: "done"; result: UploadOk }
  | { status: "error"; message: string; rateLimited?: boolean };

interface Card {
  id: string;
  filename: string;
  state: CardState;
}

// The three payroll document subtypes that fuse into one event. Completeness is
// framed around these (invoices add P&L breadth but are not required to link the
// payroll event). Mirrors the "all required document types present · cross-linked"
// framing on the dashboard validation panel.
const REQUIRED: { type: DocType; label: string }[] = [
  { type: "bank_confirmation", label: "bank confirmation" },
  { type: "payroll_register", label: "payroll register" },
  { type: "payslip", label: "payslip" },
];

const TYPE_LABEL: Record<string, string> = {
  bank_confirmation: "bank confirmation",
  payroll_register: "payroll register",
  payslip: "payslip",
  sales_invoice: "sales invoice",
  purchase_invoice: "purchase invoice",
  unknown: "unrecognised",
};

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v;
}

// A couple of headline fields per doc type, for the per-card preview.
function previewFields(doc: ExtractedDocument): Array<[string, string | number | null | undefined]> {
  switch (doc.doc_type) {
    case "bank_confirmation":
      return [["Net transfer", doc.bank_net_total], ["Payment date", doc.payment_date]];
    case "payroll_register":
      return [
        ["Gross", doc.gross_total],
        ["Employer cost", doc.employer_cost_total],
        ["Headcount", doc.register_employee_count],
      ];
    case "payslip":
      return [
        ["Employee", doc.employee?.name],
        ["Net", doc.employee?.net],
        ["Employer cost", doc.employee?.employer_cost],
      ];
    case "sales_invoice":
    case "purchase_invoice":
      return [
        ["Counterparty", doc.counterparty],
        ["Net", doc.net_amount],
        ["Gross (incl. VAT)", doc.gross_amount],
      ];
    default:
      return [["Company", doc.company]];
  }
}

let cardSeq = 0;

export function UploadDropzone() {
  const [cards, setCards] = useState<Card[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(async (file: File) => {
    const id = `card-${cardSeq++}`;
    setCards((prev) => [...prev, { id, filename: file.name, state: { status: "reading" } }]);

    // Client-side size pre-check (the server re-validates authoritatively).
    if (file.size > MAX_UPLOAD_BYTES) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, state: { status: "error", message: `Too large — limit is ${(MAX_UPLOAD_BYTES / 1024 / 1024) | 0} MB.` } }
            : c
        )
      );
      return;
    }

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as UploadOk & { error?: string };
      if (!res.ok || data.error) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  state: {
                    status: "error",
                    message: data.error ?? `Upload failed (${res.status}).`,
                    rateLimited: res.status === 429,
                  },
                }
              : c
          )
        );
        return;
      }
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, state: { status: "done", result: data } } : c)));
      // Analytics: a real, successful live extraction. No PII — type only.
      track("document_uploaded", { type: data.docType });
    } catch {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, state: { status: "error", message: "Network error — please retry." } } : c))
      );
    }
  }, []);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      for (const file of Array.from(list)) void uploadOne(file);
    },
    [uploadOne]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // Completeness derivation over successfully-extracted docs (display only —
  // never calls the server linkEvent or touches canonical numbers).
  const extracted = cards
    .map((c) => (c.state.status === "done" ? c.state.result.docType : null))
    .filter((t): t is DocType => t !== null);
  const presentTypes = new Set(extracted);
  const missing = REQUIRED.filter((r) => !presentTypes.has(r.type));
  const showVerdict = extracted.length >= 2;
  const complete = missing.length === 0;

  return (
    <section className="panel upload-zone-panel">
      <div className="section-title">
        <h3>1 · Drop your own documents</h3>
        <span className="tag">Live · {UPLOAD_DAILY_LIMIT}/day</span>
      </div>
      <p className="status">
        Drop your bank statement, payroll register and invoices — Archon reads each one with{" "}
        <strong>AWS Bedrock vision</strong>, classifies it, then links them into one event. Public demo:
        live uploads are globally capped at {UPLOAD_DAILY_LIMIT}/day to bound AWS spend; the curated
        samples below always work.
      </p>

      <div
        className={`dropzone${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <strong>Drop documents here</strong>
        <span className="dropzone-hint">or click to choose — PDF, PNG or JPEG, up to 3 MB each</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {cards.length > 0 && (
        <div className="upload-cards">
          {cards.map((card) => (
            <div key={card.id} className={`upload-card ${card.state.status}`}>
              <div className="upload-card-head">
                <span className="upload-card-name">{card.filename}</span>
                {card.state.status === "reading" && <span className="tag">reading…</span>}
                {card.state.status === "done" && (
                  <span className="doc-type-pill">{TYPE_LABEL[card.state.result.docType] ?? card.state.result.docType}</span>
                )}
                {card.state.status === "error" && (
                  <span className={`tag ${card.state.rateLimited ? "cached" : ""}`}>
                    {card.state.rateLimited ? "limit reached" : "error"}
                  </span>
                )}
              </div>
              {card.state.status === "done" && (
                <div className="pnl-list">
                  {previewFields(card.state.result.document).map(([k, v]) => (
                    <div className="pnl-row" key={k}>
                      <span>{k}</span>
                      <strong>{fmt(v)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {card.state.status === "error" && <p className="fail">{card.state.message}</p>}
            </div>
          ))}
        </div>
      )}

      {showVerdict && (
        <div className={`link-verdict ${complete ? "complete" : "incomplete"}`}>
          {complete ? (
            <span>✓ All required document types present · cross-linked into one event.</span>
          ) : (
            <span>
              ⚠️ Linked {presentTypes.size} document type{presentTypes.size === 1 ? "" : "s"} — looks like you&apos;re
              missing a {missing.map((m) => m.label).join(" and a ")}.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
