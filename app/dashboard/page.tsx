import { dbMode } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { getOrCreateLatestReport } from "@/lib/report-service";
import { buildDashboardVM } from "@/lib/dashboard-vm";
import { DashboardDataProvider } from "@/components/dashboard/data-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { PnlPanel } from "@/components/dashboard/pnl-panel";
import { CashflowPanel } from "@/components/dashboard/cashflow-panel";
import { SalesPanel } from "@/components/dashboard/sales-panel";
import { SuppliersPanel } from "@/components/dashboard/suppliers-panel";
import { WorkingCapitalPanel } from "@/components/dashboard/working-capital-panel";
import { PayrollPanel } from "@/components/dashboard/payroll-panel";
import { DocumentIntake } from "@/components/dashboard/document-intake";
import { AgentLedger } from "@/components/dashboard/agent-ledger";
import { CitationsPanel } from "@/components/dashboard/citations-panel";
import { AskArchon } from "@/components/dashboard/ask-archon";
import { SiteNavAuth } from "@/app/components/SiteNavAuth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let report;
  try {
    report = await getOrCreateLatestReport();
  } catch {
    // A transient database error must never white-screen the judge demo:
    // fall back to a fresh, unpersisted deterministic run.
    report = await runPipeline(undefined, dbMode());
  }
  const vm = buildDashboardVM(report);

  return (
    <DashboardDataProvider value={vm}>
      <DashboardShell authSlot={<SiteNavAuth />}>
        <section id="overview" className="scroll-mt-24">
          <KpiRow />
        </section>

        <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
          <div id="pnl" className="scroll-mt-24">
            <PnlPanel />
          </div>
          <div id="cash" className="scroll-mt-24">
            <CashflowPanel />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
          <div id="sales" className="scroll-mt-24">
            <SalesPanel />
          </div>
          <div id="purchases" className="scroll-mt-24">
            <SuppliersPanel />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
          <div id="capital" className="scroll-mt-24">
            <WorkingCapitalPanel />
          </div>
          <div id="payroll" className="scroll-mt-24">
            <PayrollPanel />
          </div>
          <DocumentIntake />
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
          <div id="agents" className="scroll-mt-24">
            <AgentLedger />
          </div>
          <CitationsPanel />
          <div id="ask" className="scroll-mt-24">
            <AskArchon />
          </div>
        </div>
      </DashboardShell>
    </DashboardDataProvider>
  );
}
