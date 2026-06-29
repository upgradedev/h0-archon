"use client"

import type { Kpi } from "@/lib/dashboard-vm"
import { formatEUR, formatPct } from "@/lib/format"
import { useDashboardData } from "./data-context"
import { useCountUp } from "./use-count-up"
import { Delta } from "./primitives"
import { cn } from "@/lib/utils"

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const v = useCountUp(kpi.value, 1100 + index * 90)
  let text: string
  if (kpi.display === "percent") text = formatPct(v)
  else if (kpi.display === "currencyCompact") text = formatEUR(v, { compact: true })
  else text = formatEUR(v)

  return (
    <div
      className="animate-rise relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
        <Delta value={kpi.delta} />
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums text-foreground",
          kpi.emphasis === "positive" && "text-primary",
          kpi.emphasis === "warning" && "text-[var(--warning)]",
        )}
      >
        {text}
      </div>
      <span className="text-[11px] text-muted-foreground">{kpi.hint}</span>
      <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-60" />
    </div>
  )
}

export function KpiRow() {
  const { kpis } = useDashboardData()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi, i) => (
        <KpiCard key={kpi.id} kpi={kpi} index={i} />
      ))}
    </div>
  )
}
