"use client"

import { ResponsiveContainer, Sankey, Tooltip } from "recharts"
import { formatEUR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDashboardData, useTileFlash } from "./data-context"
import { Panel } from "./primitives"
import { useMounted } from "./use-mounted"
import { Scale } from "lucide-react"

const NODE_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-3)",
]

// Minimal custom node: a colored rounded rect with the node name as a label.
// Props are recharts geometry (typed broadly — recharts injects them).
//
// This is a 3-column P&L Sankey: Revenue (left) → {COGS, Gross profit} (middle)
// → {Operating expenses, EBITDA} (right). To keep all five labels clear of the
// link ribbons we place them in the chart's margin gutters: the left column's
// label sits to the LEFT of its node, the right column's to the RIGHT, and the
// ambiguous middle column's labels are lifted ABOVE their nodes (into the
// node-padding gap) so they never collide with the band crossing the centre.
function SankeyNode(props: any) {
  const { x, y, width, height, index, payload, containerWidth } = props
  const color = NODE_COLORS[index % NODE_COLORS.length]
  const cx = x + width / 2

  let labelX = cx
  let labelY = y + height / 2
  let anchor: "start" | "middle" | "end" = "middle"
  let baseline: "middle" | "auto" = "middle"
  if (cx < containerWidth * 0.34) {
    // Left column → label in the left gutter, ending just before the node.
    labelX = x - 6
    anchor = "end"
  } else if (cx > containerWidth * 0.66) {
    // Right column → label in the right gutter, starting just after the node.
    labelX = x + width + 6
    anchor = "start"
  } else {
    // Middle column → label above the node, centred, clear of the ribbons.
    labelX = cx
    labelY = y - 6
    anchor = "middle"
    baseline = "auto"
  }

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} fill={color} fillOpacity={0.95} />
      <text
        x={labelX}
        y={labelY}
        textAnchor={anchor}
        dominantBaseline={baseline}
        fontSize={11}
        fill="var(--foreground)"
      >
        {payload?.name}
      </text>
    </g>
  )
}

// Minimal custom link: a soft emerald ribbon (visible on both light and dark).
function SankeyLink(props: any) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index } =
    props
  return (
    <path
      key={index}
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke="var(--chart-3)"
      strokeWidth={linkWidth}
      strokeOpacity={0.28}
    />
  )
}

export function PnlPanel() {
  const { pnl, opexBreakdown } = useDashboardData()
  const flash = useTileFlash("pnl")
  const maxOpex = Math.max(...opexBreakdown.map((o) => o.value))
  const mounted = useMounted()

  // Named euro magnitudes (positive) straight off the VM — no array re-parsing.
  const { cogs, grossProfit, operatingExpenses, ebitda, ebitdaMarginPct } = pnl

  // Revenue → {COGS, Gross profit}; Gross profit → {Operating expenses, EBITDA}.
  const sankeyData = {
    nodes: [
      { name: "Revenue" },
      { name: "COGS" },
      { name: "Gross profit" },
      { name: "Operating expenses" },
      { name: "EBITDA" },
    ],
    links: [
      { source: 0, target: 1, value: cogs },
      { source: 0, target: 2, value: grossProfit },
      { source: 2, target: 3, value: operatingExpenses },
      { source: 2, target: 4, value: ebitda },
    ],
  }

  return (
    <Panel
      title="Profit & Loss"
      subtitle="Revenue → COGS → gross profit → opex → EBITDA"
      className={cn(flash && "tile-flash")}
      icon={<Scale className="size-4" />}
      action={
        <span className="text-xs text-muted-foreground">
          EBITDA margin {ebitdaMarginPct.toFixed(1)}%
        </span>
      }
    >
      <div className="h-[240px] w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              node={<SankeyNode />}
              link={<SankeyLink />}
              nodePadding={30}
              nodeWidth={14}
              margin={{ top: 24, right: 120, bottom: 12, left: 64 }}
            >
              <Tooltip
                formatter={(value: any) => formatEUR(Number(value) || 0, { compact: true })}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
            </Sankey>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 border-t border-border/70 pt-3">
        {pnl.steps.map((d) => (
          <div key={d.name} className="min-w-0">
            <div className="truncate text-[11px] text-muted-foreground">{d.name}</div>
            <div className="truncate text-xs font-semibold tabular-nums text-foreground">
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
