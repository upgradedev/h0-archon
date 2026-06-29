import { ArrowUpRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"

export function CtaFooter() {
  return (
    <>
      <section id="cta" className="px-6 pb-24 pt-4 md:pb-32">
        <Reveal className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center md:px-16 md:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,oklch(0.43_0.082_162/0.45),transparent_60%)]"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-balance font-heading text-3xl font-medium tracking-tight text-background md:text-4xl">
                Close the month from the documents you already have.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-background/70">
                Connect your inbox and bank feed. Archon reads, computes and
                hands you books you can take into any boardroom.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/dashboard"
                  className={cn(buttonVariants({ size: "lg" }), "group h-11 rounded-full bg-background px-5 text-sm text-foreground hover:bg-background/90")}
                >
                  Open the dashboard
                  <ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                <a
                  href="mailto:tf@upgrade.net.gr"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 rounded-full border-background/25 bg-transparent px-5 text-sm text-background hover:bg-background/10 hover:text-background")}
                >
                  Talk to the team
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-semibold">A</span>
            </span>
            <span className="text-base font-semibold tracking-tight">
              Archon
            </span>
          </div>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground"
            aria-label="Footer"
          >
            <a href="#modules" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#engine" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#stack" className="transition-colors hover:text-foreground">
              Stack
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Security
            </a>
          </nav>
          <p className="text-xs text-muted-foreground">
            © 2026 Archon. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
