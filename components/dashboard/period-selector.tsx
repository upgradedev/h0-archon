"use client"

import { ALL_PERIODS, useDashboardPeriods } from "./data-context"
import { Calendar, ChevronDown } from "lucide-react"

// Compact reporting-period picker: the five demo months plus an "All periods"
// aggregate. Styled to match the top-bar chip it replaces.
export function PeriodSelector() {
  const { periods, selected, setSelected } = useDashboardPeriods()

  return (
    <label className="relative flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus-within:ring-2 focus-within:ring-primary/40">
      <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Reporting period</span>
      <select
        aria-label="Reporting period"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-medium text-foreground outline-none"
      >
        <option value={ALL_PERIODS}>All periods</option>
        {periods.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  )
}
