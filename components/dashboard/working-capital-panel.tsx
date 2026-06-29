"use client"

import { formatEUR } from "@/lib/format"
import { useDashboardData } from "./data-context"
import { Panel } from "./primitives"
import { Repeat } from "lucide-react"

export function WorkingCapitalPanel() {
  const { workingCapital: wc } = useDashboardData()
  const cells = [
    { ...wc.receivables, accent: "var(--chart-1)" },
    { ...wc.payables, accent: "var(--chart-5)" },
    { ...wc.vat, accent: "var(--chart-3)" },
    { ...wc.gap, accent: "var(--chart-2)" },
  ]
  return (
    <Panel
      title="Working capital"
      subtitle="Receivables, payables, VAT & conversion gap"
      icon={<Repeat className="size-4" />}
    >
      <div className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div
            key={c.label}
            className="relative overflow-hidden rounded-lg border border-border/70 bg-muted/30 p-3"
          >
            <span
              className="absolute left-0 top-0 h-full w-1"
              style={{ background: c.accent }}
            />
            <div className="pl-1.5">
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatEUR(c.value, { compact: true })}
              </div>
              <div className="text-[11px] text-muted-foreground">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Cash is tied up for{" "}
        <span className="font-medium text-foreground">{wc.gap.days} days</span> between paying suppliers
        and collecting from customers — a{" "}
        <span className="font-medium text-foreground">{formatEUR(wc.gap.value, { compact: true })}</span>{" "}
        funding requirement.
      </p>
    </Panel>
  )
}
