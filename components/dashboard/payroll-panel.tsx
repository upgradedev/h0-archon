"use client"

import { formatEUR } from "@/lib/format"
import { useDashboardData } from "./data-context"
import { Panel, Pill } from "./primitives"
import { ShieldAlert } from "lucide-react"

export function PayrollPanel() {
  const { payroll } = useDashboardData()
  const varianceCount = payroll.hiddenBreakdown.length
  return (
    <Panel
      title="Payroll controls"
      subtitle={`${payroll.headcount} employees · true employer cost vs bank`}
      icon={<ShieldAlert className="size-4" />}
      action={
        <Pill tone="warning">
          {varianceCount} variance{varianceCount === 1 ? "" : "s"} flagged
        </Pill>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="text-[11px] text-muted-foreground">Bank outflow</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
            {formatEUR(payroll.bankOutflow)}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
          <div className="text-[11px] text-muted-foreground">True employer cost</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--warning)]">
            {formatEUR(payroll.trueEmployerCost)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2">
        <span className="text-xs font-medium text-foreground">Employer IKA hidden on bank run</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--warning)]">
          +{formatEUR(payroll.employerWedge)} · {payroll.employerWedgePct}% of net
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
        <span className="text-xs text-muted-foreground">Total understated vs true cost</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          +{formatEUR(payroll.hidden)} · {payroll.hiddenPct}% of true cost
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          What the bank salary run omits
        </div>
        {payroll.hiddenBreakdown.map((b) => (
          <div key={b.name} className="flex items-center justify-between text-xs">
            <span className="truncate text-foreground">{b.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatEUR(b.value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
