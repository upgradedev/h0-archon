"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { track } from "@vercel/analytics"
import type { Agent } from "@/lib/dashboard-vm"
import type { AnalysisReport, DocType, ExtractedDocument } from "@/lib/types"
import { buildPeriodData } from "@/lib/demo-periods"
import { diffTiles } from "@/lib/recompute"
import { MAX_UPLOAD_BYTES, UPLOAD_DAILY_LIMIT } from "@/lib/upload"
import {
  selectVM,
  useDashboardData,
  useDashboardPeriods,
  useDashboardSession,
} from "./data-context"
import { Panel, Pill } from "./primitives"
import { Bot, Check, Loader2, AlertTriangle, Circle, Upload, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

// Local per-run animation status (extends the VM Agent status with "idle"/"queued").
type RunStatus = "idle" | "running" | "done"

// Success shape of POST /api/upload (mirrors the route).
interface UploadOk {
  mode: "live"
  modelId: string
  region: string
  filename: string
  docType: DocType
  document: ExtractedDocument
  confidence: number
  flags: string[]
  tokens: { input: number; output: number }
}

const AGENT_COUNT = 8
const STEP_MS = 420 // per-agent stagger so each stage is visibly fired
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Friendly labels for the raw extractor doc_type — shown on the upload chip so a
// viewer can read what Bedrock decided the document was.
const DOC_TYPE_LABELS: Record<DocType, string> = {
  bank_confirmation: "Bank confirmation",
  payroll_register: "Payroll register",
  payslip: "Payslip",
  sales_invoice: "Sales invoice",
  purchase_invoice: "Purchase invoice",
  unknown: "Document",
}

// Persistent on-screen record of the document that went IN. `reading` shows while
// the live /api/upload call is in flight; `read` after a successful extraction
// (with type + confidence); `error` if the upload itself failed.
type UploadChip =
  | { name: string; phase: "reading" }
  | { name: string; phase: "read"; label: string; pct: number }
  | { name: string; phase: "error" }

function StatusIcon({ status }: { status: Agent["status"] | "idle" }) {
  if (status === "done")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary">
        <Check className="size-3.5" />
      </span>
    )
  if (status === "running")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[var(--chart-2)]/15 text-[var(--chart-2)]">
        <Loader2 className="size-3.5 animate-spin" />
      </span>
    )
  if (status === "idle")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground/60">
        <Circle className="size-3" />
      </span>
    )
  return (
    <span className="grid size-6 place-items-center rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
      <AlertTriangle className="size-3.5" />
    </span>
  )
}

export function AgentLedger() {
  const { agents, period } = useDashboardData()
  const { selected } = useDashboardPeriods()
  const { data, setPeriodData, resetPeriodData, isCustom, flash } = useDashboardSession()

  // When a run is active this overlays each agent's animated status; otherwise the
  // ledger shows the VM agents (all done).
  const [run, setRun] = useState<Record<number, RunStatus> | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // Filename chip — additive UI only; persists after the run as a record of the
  // uploaded document. Cleared by "Reset to demo".
  const [chip, setChip] = useState<UploadChip | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const statusOf = (a: Agent): Agent["status"] | "idle" => (run ? (run[a.id] ?? "idle") : a.status)
  const done = agents.filter((a) => statusOf(a) === "done").length

  const process = useCallback(
    async (files: File[]) => {
      if (busy || files.length === 0) return
      setError(null)
      setToast(null)
      setBusy(true)

      // Echo the chosen document immediately — BEFORE the network call — so a
      // viewer sees the document go IN. The chip tracks the first file (demo is
      // single-file; the "+N more" suffix keeps multi-select honest).
      const extra = files.length - 1
      const chipName = extra > 0 ? `${files[0].name} +${extra} more` : files[0].name
      setChip({ name: chipName, phase: "reading" })

      // Start the ledger: all idle, Extractor (agent 1) running — bound to the
      // real, in-flight Bedrock upload call below.
      const initial: Record<number, RunStatus> = {}
      for (let i = 1; i <= AGENT_COUNT; i++) initial[i] = i === 1 ? "running" : "idle"
      setRun(initial)

      // 1. Live Bedrock extraction per file (Extractor is genuinely in-flight).
      const extracted: ExtractedDocument[] = []
      let firstResult: { docType: DocType; confidence: number } | null = null
      try {
        for (let idx = 0; idx < files.length; idx++) {
          const file = files[idx]
          if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error(
              `"${file.name}" is too large — limit is ${(MAX_UPLOAD_BYTES / 1024 / 1024) | 0} MB.`,
            )
          }
          const body = new FormData()
          body.append("file", file)
          const res = await fetch("/api/upload", { method: "POST", body })
          const payload = (await res.json()) as UploadOk & { error?: string }
          if (!res.ok || payload.error || !payload.document) {
            throw new Error(payload.error ?? `Upload failed (${res.status}).`)
          }
          extracted.push(payload.document)
          if (idx === 0) firstResult = { docType: payload.docType, confidence: payload.confidence }
          // Analytics: a real, successful live extraction. No PII — type only.
          track("document_uploaded", { type: payload.docType })
        }
      } catch (e) {
        setRun(null)
        setBusy(false)
        setChip({ name: chipName, phase: "error" })
        setError((e as Error)?.message ?? "Upload failed — please retry.")
        return
      }

      // The document was read — promote the chip to a persistent "read" record
      // (type + confidence). It stays on screen through the cascade and after.
      if (firstResult) {
        setChip({
          name: chipName,
          phase: "read",
          label: DOC_TYPE_LABELS[firstResult.docType] ?? "Document",
          pct: Math.round(firstResult.confidence * 100),
        })
      }

      // Extractor done. Kick off the recompute now — the remaining seven stages
      // (Classifier → … → Narrator) really run server-side inside it.
      setRun((prev) => ({ ...(prev ?? initial), 1: "done" }))
      const recomputeP = fetch("/api/recompute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documents: extracted }),
      }).then(async (res) => {
        const payload = (await res.json()) as {
          report?: AnalysisReport
          invoices?: ExtractedDocument[]
          error?: string
        }
        if (!res.ok || payload.error || !payload.report) {
          throw new Error(payload.error ?? "Recompute failed.")
        }
        return { report: payload.report, invoices: payload.invoices ?? [] }
      })

      // 2. Cascade the remaining seven agents step-by-step so each visibly fires.
      for (let id = 2; id <= AGENT_COUNT; id++) {
        setRun((prev) => ({ ...(prev ?? {}), [id]: "running" }))
        await sleep(STEP_MS)
        setRun((prev) => ({ ...(prev ?? {}), [id]: "done" }))
      }

      // 3. Swap the recomputed dataset into the dashboard + flash the changed tiles.
      try {
        const { report, invoices } = await recomputeP
        const oldVM = selectVM(data, selected)
        const newData = buildPeriodData(report, invoices)
        const newVM = selectVM(newData, selected)
        const changed = diffTiles(oldVM, newVM)
        setPeriodData(newData) // PER-SESSION ONLY — never persisted
        flash(changed)
        const n = files.length
        setToast(
          `${n} document${n === 1 ? "" : "s"} added · ${changed.length} tile${changed.length === 1 ? "" : "s"} updated`,
        )
      } catch (e) {
        setError((e as Error)?.message ?? "Recompute failed.")
      } finally {
        setRun(null)
        setBusy(false)
      }
    },
    [busy, data, selected, setPeriodData, flash],
  )

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return
      void process(Array.from(list))
    },
    [process],
  )

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      onFiles(e.dataTransfer.files)
    },
    [onFiles],
  )

  return (
    <Panel
      title={`${agents.length}-agent run ledger`}
      subtitle={busy ? "processing your document…" : `${done}/${agents.length} complete · close pipeline`}
      icon={<Bot className="size-4" />}
      action={<Pill tone="info">Run · {period}</Pill>}
    >
      {/* Upload drop-zone — the PRIMARY live-extraction entry point. Drop a document
          and watch the eight agents fire, then the affected tiles flash + refresh. */}
      <div
        className={cn(
          "mb-3 flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-3 py-3 text-center transition-colors",
          dragging && "border-primary bg-primary/5",
          busy && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
        }}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload className="size-3.5" /> Upload documents
        </span>
        <span className="text-[11px] text-muted-foreground">
          Drop a PDF/PNG/JPEG (up to {(MAX_UPLOAD_BYTES / 1024 / 1024) | 0} MB) — live AWS Bedrock
          read · {UPLOAD_DAILY_LIMIT}/day
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {/* Persistent record of what was uploaded — sits OUTSIDE the dropzone so it
          stays full-opacity while the dropzone dims during a run. */}
      {chip && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            chip.phase === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/30 bg-primary/5 text-foreground",
          )}
        >
          <span aria-hidden>📄</span>
          <span className="min-w-0 flex-1 truncate font-medium">{chip.name}</span>
          {chip.phase === "reading" && (
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> reading…
            </span>
          )}
          {chip.phase === "read" && (
            <span className="flex shrink-0 items-center gap-1 font-medium text-primary">
              <Check className="size-3" /> read · {chip.label} · {chip.pct}%
            </span>
          )}
          {chip.phase === "error" && (
            <span className="shrink-0">couldn&apos;t read (try again)</span>
          )}
        </div>
      )}

      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

      {isCustom && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
          <span className="truncate text-[11px] text-muted-foreground">
            Showing a per-session recompute with your document.
          </span>
          <button
            type="button"
            onClick={() => {
              resetPeriodData()
              setChip(null)
              setToast("Reverted to the demo close.")
            }}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="size-3" /> Reset to demo
          </button>
        </div>
      )}

      <ol className="relative space-y-0">
        {agents.map((a, i) => {
          const status = statusOf(a)
          return (
            <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < agents.length - 1 && (
                <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-border" />
              )}
              <div className="z-10 pt-0.5">
                <StatusIcon status={status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    <span className="text-muted-foreground">{a.id}.</span> {a.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      status === "flagged" ? "text-[var(--warning)]" : "text-muted-foreground",
                    )}
                  >
                    {status === "running"
                      ? "running…"
                      : status === "idle"
                        ? "queued"
                        : a.duration}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-muted-foreground">{a.role}</span>
                  {status !== "running" && status !== "idle" && (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {status === "flagged"
                        ? `${a.items} exception`
                        : `${a.items} items · ${a.confidence}%`}
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg">
          {toast}
        </div>
      )}
    </Panel>
  )
}
