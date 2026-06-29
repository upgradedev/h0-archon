"use client"

import { useState } from "react"
import type { ValidationResult } from "@/lib/types"
import type { ValidationScenario } from "@/lib/tamper"
import { useDashboardData } from "./data-context"
import { Panel, Pill } from "./primitives"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ShieldCheck, ShieldAlert, Check, AlertTriangle, Loader2 } from "lucide-react"

// A single cross-document rule row: human label, the actual compared values, and
// a pass/fail pill. `failed` rows are tinted red so a tampered run reads at a glance.
function RuleRow({ result }: { result: ValidationResult }) {
  const ok = result.passed
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5",
        ok ? "border-border/70 bg-muted/30" : "border-destructive/40 bg-destructive/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
          ok ? "bg-primary/15 text-primary" : "bg-destructive/20 text-destructive",
        )}
      >
        {ok ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{result.rule}</span>
          <span className="truncate text-sm font-medium text-foreground">{result.description}</span>
        </div>
        <p className="mt-0.5 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {result.detail}
        </p>
      </div>
      <Pill tone={ok ? "positive" : "danger"} className="mt-0.5 shrink-0">
        {ok ? "pass" : "fail"}
      </Pill>
    </li>
  )
}

export function ValidationPanel() {
  const { validations } = useDashboardData()
  const [stress, setStress] = useState(false)
  const [scenario, setScenario] = useState<ValidationScenario | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passCount = validations.filter((v) => v.passed).length
  const total = validations.length

  async function enableStress() {
    setStress(true)
    if (scenario || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/validation-scenario", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ValidationScenario
      setScenario(data)
    } catch {
      setError("Could not run the stress-test. Try again.")
    } finally {
      setLoading(false)
    }
  }

  // Which view is live: tampered (only once the scenario has loaded) or clean.
  const showingTampered = stress && !!scenario
  const tamperedFail = scenario?.tampered.find((r) => !r.passed) ?? null
  const rows: ValidationResult[] = showingTampered ? scenario!.tampered : validations

  return (
    <Panel
      title="Cross-document validation"
      subtitle="The AI proposes; the deterministic rules refuse to be fooled"
      icon={<ShieldCheck className="size-4" />}
      action={
        <Pill tone={showingTampered ? "danger" : "positive"}>
          {showingTampered
            ? `${scenario!.tampered.filter((r) => r.passed).length}/${scenario!.tampered.length} pass`
            : `${passCount}/${total} pass`}
        </Pill>
      }
    >
      {/* Headline trust statement / withheld state */}
      {showingTampered ? (
        <div className="mb-3 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-destructive">Report withheld — flagged for review</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A cross-document check failed, so the close is not published.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {passCount}/{total} cross-document checks passed — every fused number is verified against
              the source documents.
            </p>
            <p className="mt-0.5 text-xs text-primary">Report released.</p>
          </div>
        </div>
      )}

      {/* The failed-rule alert (tampered run only) */}
      {showingTampered && tamperedFail && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-destructive">
            {tamperedFail.rule} FAILED — {tamperedFail.detail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Simulated mis-read: {scenario!.tamperNote} (field{" "}
            <span className="font-mono">{scenario!.tamperedField}</span>). The deterministic engine
            caught the disagreement between the documents and refused to publish the figure.
          </p>
        </div>
      )}

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <RuleRow key={r.rule} result={r} />
        ))}
      </ul>

      {/* Stress-test control */}
      <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3">
        <p className="text-sm font-medium text-foreground">
          Stress-test: what if the AI mis-reads a document?
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This deliberately corrupts one extracted field to prove the safety net — a simulation, not a
          real extraction error.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {!showingTampered ? (
            <Button size="sm" variant="destructive" onClick={enableStress} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <ShieldAlert className="size-3.5" /> Run stress-test
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setStress(false)}>
              <ShieldCheck className="size-3.5" /> Back to verified report
            </Button>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        AWS Bedrock vision proposes the numbers; the deterministic engine cross-checks them against
        every source document and refuses to publish a figure the documents don&apos;t agree on.
      </p>
    </Panel>
  )
}
