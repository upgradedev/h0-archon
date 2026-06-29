"use client"

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"
import type { PnlStep } from "@/lib/dashboard-vm"
import { formatEUR } from "@/lib/format"
import { useDashboardData } from "./data-context"
import { Panel } from "./primitives"
import { useMounted } from "./use-mounted"
import { Scale } from "lucide-react"

// Build a waterfall: each bar sits on a transparent base.
function buildWaterfall(pnl: PnlStep[]) {
  let running = 0
  return pnl.map((step) => {
    if (step.kind === "total") {
      const base = 0
      const bar = step.value
      running = step.value
      return { name: step.name, base, bar, value: step.value, kind: step.kind }
    }
    if (step.kind === "base") {
      const base = 0
      const bar = step.value
      running = step.value
      return { name: step.name, base, bar, value: step.value, kind: step.kind }
    }
    // subtract
    const next = running + step.value // value is negative
    const base = next
    const bar = -step.value
    running = next
    return { name: step.name, base, bar, value: step.value, kind: step.kind }
  })
}

const colorFor = (kind: string) =>
  kind === "subtract" ? "var(--chart-5)" : kind === "total" ? "var(--chart-1)" : "var(--chart-2)"

export function PnlPanel() {
  const { pnl, opexBreakdown } = useDashboardData()
  const data = buildWaterfall(pnl)
  const maxOpex = Math.max(...opexBreakdown.map((o) => o.value))
  const mounted = useMounted()

  const revenue = pnl.find((step) => step.kind === "base")?.value ?? 0
  const ebitda = pnl[pnl.length - 1]?.value ?? 0
  const ebitdaMargin = revenue === 0 ? 0 : (ebitda / revenue) * 100

  return (
    <Panel
      title="Profit & Loss"
      subtitle="Revenue → COGS → gross profit → opex → EBITDA"
      icon={<Scale className="size-4" />}
      action={
        <span className="text-xs text-muted-foreground">
          EBITDA margin {ebitdaMargin.toFixed(1)}%
        </span>
      }
    >
      <div className="h-44 w-full">
        {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              interval={0}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="bar" stackId="a" radius={[4, 4, 4, 4]} maxBarSize={46}>
              {data.map((d, i) => (
                <Cell key={i} fill={colorFor(d.kind)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 border-t border-border/70 pt-3">
        {data.map((d) => (
          <div key={d.name} className="min-w-0">
            <div className="truncate text-[11px] text-muted-foreground">{d.name}</div>
            <div
              className="truncate text-xs font-semibold tabular-nums"
              style={{ color: colorFor(d.kind) }}
            >
              {d.value < 0 ? "−" : ""}
              {formatEUR(Math.abs(d.value), { compact: true })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Operating expense mix
        </div>
        {opexBreakdown.map((o) => (
          <div key={o.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-foreground">{o.name}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--chart-2)]"
                style={{ width: `${(o.value / maxOpex) * 100}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {formatEUR(o.value, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
