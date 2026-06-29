"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatEUR } from "@/lib/format"
import { useDashboardPeriods } from "./data-context"
import { Panel } from "./primitives"
import { useMounted } from "./use-mounted"
import { TrendingUp } from "lucide-react"

const series = [
  { key: "revenue", name: "Revenue", color: "var(--chart-1)" },
  { key: "ebitda", name: "EBITDA", color: "var(--chart-2)" },
  { key: "closingCash", name: "Closing cash", color: "var(--chart-3)" },
] as const

export function TrendStrip() {
  const { trends } = useDashboardPeriods()
  const mounted = useMounted()

  const latest = trends[trends.length - 1]
  const first = trends[0]
  const revenueDelta =
    first && latest && first.revenue !== 0
      ? ((latest.revenue - first.revenue) / first.revenue) * 100
      : 0

  return (
    <Panel
      title="Trend — last 5 months"
      subtitle="Revenue, EBITDA, and closing cash · Jan → May 2026"
      icon={<TrendingUp className="size-4" />}
      action={
        <span className="text-xs text-muted-foreground">
          Revenue {revenueDelta >= 0 ? "+" : "−"}
          {Math.abs(revenueDelta).toFixed(0)}% vs Jan
        </span>
      }
    >
      <div className="h-56 w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(value) => formatEUR(Number(value), { compact: true })}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                formatter={(value) => formatEUR(Number(value), { compact: true })}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                iconType="plainline"
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 2.5, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </Panel>
  )
}
