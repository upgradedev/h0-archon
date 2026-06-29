"use client"

import { useState } from "react"
import { formatEUR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDashboardData, useTileFlash } from "./data-context"
import { Panel, Pill } from "./primitives"
import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react"

export function PayrollPanel() {
  const { payroll } = useDashboardData()
  const flash = useTileFlash("payroll")
  const varianceCount = payroll.hiddenBreakdown.length
  const [showEmployees, setShowEmployees] = useState(false)
  const employees = payroll.employees
  return (
    <Panel
      title="Payroll controls"
      subtitle={`${payroll.headcount} employees · true employer cost vs bank`}
      className={cn(flash && "tile-flash")}
      icon={<ShieldAlert className="size-4" />}
      action={
        <Pill tone="warning">
          {varianceCount} register line{varianceCount === 1 ? "" : "s"} correlated
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
        <span className="text-xs font-medium text-foreground">Employer social-security contributions (not in the bank transfer)</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--warning)]">
          +{formatEUR(payroll.employerWedge)} · {payroll.employerWedgePct}% of net
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          True employer cost vs bank transfer · only visible once correlated
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          +{formatEUR(payroll.hidden)} · {payroll.hiddenPct}% of true cost
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          In the register but not on the bank transfer
        </div>
        {payroll.hiddenBreakdown.map((b) => (
          <div key={b.name} className="flex items-center justify-between text-xs">
            <span className="truncate text-foreground">{b.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatEUR(b.value)}</span>
          </div>
        ))}
      </div>

      {employees.length > 0 && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <button
            type="button"
            onClick={() => setShowEmployees((v) => !v)}
            aria-expanded={showEmployees}
            className="flex w-full items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {showEmployees ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Per-employee breakdown ({employees.length})
          </button>

          {showEmployees && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/70">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/70 text-[11px] text-muted-foreground">
                    <th className="px-2.5 py-1.5 text-left font-medium">Employee</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Gross</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Net</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">True employer cost</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.name} className="border-b border-border/40 last:border-0">
                      <td className="truncate px-2.5 py-1.5 text-foreground">{e.name}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatEUR(e.gross)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatEUR(e.net)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-[var(--warning)]">
                        {formatEUR(e.employerCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/70 font-semibold">
                    <td className="px-2.5 py-1.5 text-left text-foreground">Total</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatEUR(employees.reduce((s, e) => s + e.gross, 0))}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatEUR(employees.reduce((s, e) => s + e.net, 0))}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--warning)]">
                      {formatEUR(payroll.trueEmployerCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
