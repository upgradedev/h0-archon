"use client"

import type { Agent } from "@/lib/dashboard-vm"
import { useDashboardData } from "./data-context"
import { Panel, Pill } from "./primitives"
import { Bot, Check, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

function StatusIcon({ status }: { status: Agent["status"] }) {
  if (status === "done")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary">
        <Check className="size-3.5" />
      </span>
    )
  if (status === "running")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[var(--chart-2)]/15 text-[var(--chart-2)]">
        <Loader2 className="size-3.5 animate-spin" />
      </span>
    )
  return (
    <span className="grid size-6 place-items-center rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
      <AlertTriangle className="size-3.5" />
    </span>
  )
}

export function AgentLedger() {
  const { agents, period } = useDashboardData()
  const done = agents.filter((a) => a.status === "done").length
  return (
    <Panel
      title={`${agents.length}-agent run ledger`}
      subtitle={`${done}/${agents.length} complete · close pipeline`}
      icon={<Bot className="size-4" />}
      action={<Pill tone="info">Run · {period}</Pill>}
    >
      <ol className="relative space-y-0">
        {agents.map((a, i) => (
          <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < agents.length - 1 && (
              <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-border" />
            )}
            <div className="z-10 pt-0.5">
              <StatusIcon status={a.status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{a.id}.</span> {a.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    a.status === "flagged" ? "text-[var(--warning)]" : "text-muted-foreground",
                  )}
                >
                  {a.status === "running" ? "running…" : a.duration}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground">{a.role}</span>
                {a.status !== "running" && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {a.status === "flagged"
                      ? `${a.items} exception`
                      : `${a.items} items · ${a.confidence}%`}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
