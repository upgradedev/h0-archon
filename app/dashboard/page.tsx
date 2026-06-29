import "../legacy.css";
import { ArchonDashboard } from "../components/ArchonDashboard";
import { SiteNav } from "../components/SiteNav";
import { SiteNavAuth } from "../components/SiteNavAuth";
import { dbMode } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { getOrCreateLatestReport } from "@/lib/report-service";

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
  return (
    <>
      <SiteNav authSlot={<SiteNavAuth />} />
      <ArchonDashboard initialReport={report} />
    </>
  );
}
