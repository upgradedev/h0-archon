"use client"

import { motion } from "motion/react"
import {
  LineChart,
  Wallet,
  Target,
  Truck,
  Scale,
  Users,
} from "lucide-react"
import { Reveal } from "./reveal"

const modules = [
  {
    icon: LineChart,
    title: "P&L",
    body: "A statement that ties to the source documents, line by line — revenue, cost of sales and operating expense, recomputed every close.",
  },
  {
    icon: Wallet,
    title: "Cash flow",
    body: "Operating, investing and financing movement reconciled against your bank feed, so closing cash is a fact rather than a guess.",
  },
  {
    icon: Target,
    title: "Sales performance",
    body: "Results by salesperson, attainment versus goal, and contribution margin — the commercial detail behind the headline number.",
  },
  {
    icon: Truck,
    title: "Purchases & suppliers",
    body: "Every purchase invoice captured, matched and categorized, with spend concentrated and ranked by supplier.",
  },
  {
    icon: Scale,
    title: "Receivables & payables",
    body: "Customer and supplier statements, VAT position and working-capital exposure, kept current as documents arrive.",
  },
  {
    icon: Users,
    title: "Payroll controls",
    body: "Gross-to-net checks that surface the hidden ~28% employer cost most teams forget to plan for.",
  },
]

export function Modules() {
  return (
    <section id="modules" className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-medium text-primary">The platform</p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-medium tracking-tight md:text-4xl">
            Full-company financial intelligence, not a single report.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Six modules work from the same fused ledger. Payroll is just one of
            them — Archon understands the whole business.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: (i % 3) * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group bg-card p-8 transition-colors hover:bg-secondary/40"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                <m.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-medium tracking-tight">
                {m.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {m.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
