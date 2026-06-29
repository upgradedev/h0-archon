"use client"

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"
import type { CashStep } from "@/lib/dashboard-vm"
import { formatEUR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ALL_PERIODS, useDashboardData, useDashboardPeriods, useTileFlash } from "./data-context"
import { Panel } from "./primitives"
import { useMounted } from "./use-mounted"
import { Waves } from "lucide-react"

type Row = { name: string; base: number; bar: number; value: number; kind: string }

// Single-period waterfall: each colored bar floats on a transparent base so the
// running balance reads left→right (recharts stacks on the numeric axis, which is
// the x-axis under layout="vertical").
function buildWaterfall(cashflow: CashStep[]): Row[] {
  let running = 0
  return cashflow.map((step) => {
    if (step.kind === "base" || step.kind === "total") {
      running = step.value
      return { name: step.name, base: 0, bar: step.value, value: step.value, kind: step.kind }
    }
    if (step.kind === "in") {
      const base = running
      running += step.value
      return { name: step.name, base, bar: step.value, value: step.value, kind: step.kind }
    }
    // out: value is negative; draw a positive-width bar floating between next and running
    const next = running + step.value
    running = next
    return { name: step.name, base: next, bar: -step.value, value: step.value, kind: step.kind }
  })
}

// Aggregate ("All periods") magnitude view: a summed running-balance waterfall
// does not reconcile across months, so drop the cumulative base and render each
// step from zero — an honest magnitude comparison, not a fake running balance.
function buildMagnitude(cashflow: CashStep[]): Row[] {
  return cashflow.map((step) => ({
    name: step.name,
    base: 0,
    bar: Math.abs(step.value),
    value: step.value,
    kind: step.kind,
  }))
}

const colorFor = (kind: string) =>
  kind === "out" ? "var(--chart-5)" : kind === "in" ? "var(--chart-1)" : "var(--chart-2)"

export function CashflowPanel() {
  const { cashflow, cash, runwayMonths, monthlyFixedCost } = useDashboardData()
  const { selected } = useDashboardPeriods()
  const flash = useTileFlash("cash")
  const isAggregate = selected === ALL_PERIODS
  const data = isAggregate ? buildMagnitude(cashflow) : buildWaterfall(cashflow)
  const runwayPct = Math.min((runwayMonths / 24) * 100, 100)
  const mounted = useMounted()

  // Named scalar off the VM — no opening/closing re-derivation from the array.
  const netMovement = cash.netMovement

  return (
    <Panel
      title="Cash flow"
      subtitle={
        isAggregate
          ? "Summed flows across Jan–May; balances are period-end"
          : "Opening → collections → outflows → closing"
      }
      className={cn(flash && "tile-flash")}
      icon={<Waves className="size-4" />}
      action={
        <span className="text-xs text-muted-foreground">
          Net {netMovement >= 0 ? "+" : "−"}
          {formatEUR(Math.abs(netMovement), { compact: true })}
        </span>
      }
    >
      <div className="h-60 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
            >
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval={0}
              />
              <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="bar" stackId="a" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {data.map((d, i) => (
                  <Cell key={i} fill={colorFor(d.kind)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3 sm:grid-cols-6">
        {data.map((d) => (
          <div key={d.name} className="min-w-0">
            <div className="truncate text-[11px] text-muted-foreground">{d.name}</div>
            <div className="truncate text-xs font-semibold tabular-nums" style={{ color: colorFor(d.kind) }}>
              {d.value < 0 ? "−" : ""}
              {formatEUR(Math.abs(d.value), { compact: true })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Runway at current fixed cost</span>
          <span className="font-semibold tabular-nums text-primary">{runwayMonths} months</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${runwayPct}%` }} />
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {formatEUR(monthlyFixedCost, { compact: true })}/mo fixed burn · benchmark 24 mo
        </div>
      </div>
    </Panel>
  )
}
