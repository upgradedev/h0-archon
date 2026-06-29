"use client"

import { useState } from "react"
import { formatEUR, formatPct } from "@/lib/format"
import { useDashboardData } from "./data-context"
import type { Salesperson } from "@/lib/dashboard-vm"
import { Panel, Pill } from "./primitives"
import { DetailDrawer, type DetailRow } from "./detail-drawer"
import { Target } from "lucide-react"
import { cn } from "@/lib/utils"

const segmentTone: Record<string, "info" | "positive" | "neutral"> = {
  Enterprise: "info",
  "Mid-Market": "positive",
  SMB: "neutral",
}

function salespersonRows(p: Salesperson): DetailRow[] {
  const att = p.goal === 0 ? 0 : (p.actual / p.goal) * 100
  return [
    { label: "Segment", value: p.segment },
    { label: "Actual", value: formatEUR(p.actual) },
    { label: "Goal", value: formatEUR(p.goal) },
    { label: "Variance to goal", value: formatEUR(p.actual - p.goal) },
    { label: "Attainment", value: formatPct(att, 0) },
    { label: "Gross margin", value: formatPct(p.margin, 1) },
  ]
}

export function SalesPanel() {
  const { sales } = useDashboardData()
  const totalActual = sales.reduce((s, p) => s + p.actual, 0)
  const totalGoal = sales.reduce((s, p) => s + p.goal, 0)
  const attainment = (totalActual / totalGoal) * 100
  const [selected, setSelected] = useState<Salesperson | null>(null)

  return (
    <Panel
      title="Sales performance"
      subtitle="Actual vs goal by salesperson"
      icon={<Target className="size-4" />}
      action={
        <Pill tone={attainment >= 100 ? "positive" : "warning"}>
          {attainment.toFixed(0)}% team attainment
        </Pill>
      }
    >
      <div className="space-y-3">
        {sales.map((p) => {
          const att = (p.actual / p.goal) * 100
          const over = att >= 100
          return (
            <button
              key={p.name}
              onClick={() => setSelected(p)}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                {p.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatEUR(p.actual, { compact: true })}{" "}
                    <span className="text-muted-foreground/60">/ {formatEUR(p.goal, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Pill tone={segmentTone[p.segment]} className="shrink-0">
                    {p.segment}
                  </Pill>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    {/* goal marker at 100% */}
                    <div
                      className={cn(
                        "h-full rounded-full",
                        over ? "bg-primary" : "bg-[var(--chart-2)]",
                      )}
                      style={{ width: `${Math.min(att, 100)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-10 shrink-0 text-right text-xs font-semibold tabular-nums",
                      over ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {att.toFixed(0)}%
                  </span>
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {p.margin}% GM
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected ? `Salesperson · ${selected.segment}` : undefined}
        rows={selected ? salespersonRows(selected) : undefined}
      />
    </Panel>
  )
}
