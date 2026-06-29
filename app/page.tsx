import { SiteHeader } from "@/components/landing/site-header"
import { Hero } from "@/components/landing/hero"
import { MetricBand } from "@/components/landing/metric-band"
import { Modules } from "@/components/landing/modules"
import { AiCompute } from "@/components/landing/ai-compute"
import { StackStrip } from "@/components/landing/stack-strip"
import { CtaFooter } from "@/components/landing/cta-footer"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <MetricBand />
        <Modules />
        <AiCompute />
        <StackStrip />
        <CtaFooter />
      </main>
    </div>
  )
}
