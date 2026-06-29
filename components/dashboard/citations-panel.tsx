"use client"

import { useDashboardData } from "./data-context"
import { Panel } from "./primitives"
import { FileText, ArrowUpRight } from "lucide-react"

export function CitationsPanel() {
  const { citations } = useDashboardData()
  return (
    <Panel
      title="Source citations"
      subtitle="Every figure traces to a document"
      icon={<FileText className="size-4" />}
    >
      <ul className="space-y-1.5">
        {citations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/60"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs text-foreground">{c.id}</span>
                  {c.amount && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                      {c.amount}
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {c.source} · {c.ref}
                </div>
              </div>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
