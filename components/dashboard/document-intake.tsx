"use client"

import { useDashboardData } from "./data-context"
import { Panel } from "./primitives"
import { FileStack, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

const statusDot = {
  processed: "bg-primary",
  pending: "bg-[var(--chart-2)]",
  review: "bg-[var(--warning)]",
}

export function DocumentIntake() {
  const { documentIntake } = useDashboardData()
  const total = documentIntake.reduce((s, d) => s + d.count, 0)
  return (
    <Panel
      title="Document intake"
      subtitle={`${total} documents this period`}
      icon={<FileStack className="size-4" />}
      action={
        <a
          href="/extract"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          See live extraction
          <ArrowUpRight className="size-3" />
        </a>
      }
    >
      <div className="flex flex-wrap gap-2">
        {documentIntake.map((d) => (
          <div
            key={d.label}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-2.5 pr-3 text-xs"
          >
            <span className={cn("size-1.5 rounded-full", statusDot[d.status])} />
            <span className="font-medium text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{d.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" /> Processed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--warning)]" /> In review
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--chart-2)]" /> Pending
        </span>
      </div>
    </Panel>
  )
}
