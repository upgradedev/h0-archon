"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { ArrowUpRight, Play, FileText, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProductPreview } from "./product-preview"

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  // parallax: background grid drifts slower, card lifts faster
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -60])
  const cardOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section
      ref={ref}
      className="relative overflow-hidden px-6 pt-32 pb-20 md:pt-40 md:pb-28"
    >
      {/* parallax background */}
      <motion.div
        aria-hidden="true"
        style={{ y: gridY }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,oklch(0.43_0.082_162/0.10),transparent_55%)]" />
        <div className="absolute inset-x-0 top-0 h-[640px] bg-[linear-gradient(to_right,oklch(0.21_0.012_264/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.21_0.012_264/0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </motion.div>

      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <span className="flex size-1.5 rounded-full bg-primary" />
            Agentic close, now in private beta
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-balance font-heading text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl"
          >
            Every financial document your business receives, fused into one
            boardroom-ready monthly close.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            AI reads your sales, purchases, bank statements and payroll; a
            deterministic engine computes auditable books you can defend in any
            review.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="/dashboard"
              className={cn(buttonVariants({ size: "lg" }), "group h-11 rounded-full px-5 text-sm")}
            >
              Open the dashboard
              <ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="/extract"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 rounded-full px-5 text-sm")}
            >
              <Play className="fill-current" />
              Watch the AI read a document
            </a>
          </motion.div>
        </div>

        {/* floating product preview */}
        <motion.div
          style={{ y: cardY, opacity: cardOpacity }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          {/* floating annotation chips */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="absolute -left-3 top-16 z-20 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg shadow-foreground/5 lg:flex"
          >
            <FileText className="size-4 text-primary" />
            invoice_0492.pdf parsed
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="absolute -right-3 top-40 z-20 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-lg shadow-foreground/5 lg:flex"
          >
            <Sparkles className="size-4 text-primary" />
            96.7% extraction confidence
          </motion.div>

          <ProductPreview />
        </motion.div>
      </div>
    </section>
  )
}
