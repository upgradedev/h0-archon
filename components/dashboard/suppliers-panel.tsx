"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { formatEUR } from "@/lib/format"
import { useDashboardData } from "./data-context"
import { Panel, Pill } from "./primitives"
import { useMounted } from "./use-mounted"
import { Boxes } from "lucide-react"

const sliceColors = [
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--muted-foreground)",
]

const riskTone = { low: "neutral", medium: "warning", high: "danger" } as const

export function SuppliersPanel() {
  const { suppliers } = useDashboardData()
  const top3 = suppliers.slice(0, 3).reduce((s, v) => s + v.share, 0)
  const totalSpend = suppliers.reduce((s, v) => s + v.spend, 0)
  const mounted = useMounted()

  return (
    <Panel
      title="Purchases & supplier concentration"
      subtitle={`Top 3 vendors = ${top3.toFixed(0)}% of spend`}
      icon={<Boxes className="size-4" />}
      action={<Pill tone="warning">Concentration risk</Pill>}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={suppliers}
                dataKey="share"
                nameKey="name"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
              >
                {suppliers.map((_, i) => (
                  <Cell key={i} fill={sliceColors[i % sliceColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-semibold tabular-nums text-foreground">
              {formatEUR(totalSpend, { compact: true })}
            </span>
            <span className="text-[10px] text-muted-foreground">total spend</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {suppliers.map((s, i) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: sliceColors[i % sliceColors.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{s.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{s.share.toFixed(1)}%</span>
              <Pill tone={riskTone[s.risk]} className="w-16 shrink-0 justify-center capitalize">
                {s.risk}
              </Pill>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
