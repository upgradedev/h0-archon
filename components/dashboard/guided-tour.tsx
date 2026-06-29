"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { Compass } from "lucide-react"

// Self-guided product tour. driver.js runs only on click, so there is nothing to
// initialise at module load — safe for SSR. Steps target stable section ids that
// already exist in app/dashboard/page.tsx (#overview, #agents, #payroll,
// #validation) plus the header search input (#dashboard-search).
const STEPS = [
  {
    element: "#overview",
    popover: {
      title: "Your monthly close at a glance",
      description:
        "Revenue, EBITDA, cash, and AI extraction accuracy — computed by a deterministic engine.",
    },
  },
  {
    element: "#agents",
    popover: {
      title: "Drop a document here",
      description:
        "Eight agents read it live (AWS Bedrock), link it, validate it, and recompute the close — the tiles update instantly.",
    },
  },
  {
    element: "#payroll",
    popover: {
      title: "The payroll truth",
      description:
        "The bank shows €3,995, but the real employer cost is €6,930 — the €2,935 social-security + tax wedge only correlation reveals.",
    },
  },
  {
    element: "#validation",
    popover: {
      title: "Cross-document validation",
      description:
        "Four checks must pass before a close is trusted. Run the stress-test to see the completeness check catch a missing document.",
    },
  },
  {
    element: "#dashboard-search",
    popover: {
      title: "Search everything you uploaded",
      description:
        "Find any uploaded document, vendor or person — invoices come back with their number and date.",
    },
  },
]

export function GuidedTour() {
  function startTour() {
    driver({ showProgress: true, steps: STEPS }).drive()
  }

  return (
    <button
      type="button"
      onClick={startTour}
      aria-label="Take the tour"
      title="Take the tour"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Compass className="size-4" />
      <span className="hidden sm:inline">Take the tour</span>
    </button>
  )
}
