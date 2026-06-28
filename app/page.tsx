import { ArchonDashboard } from "./components/ArchonDashboard";
import { dbMode, getLatestReport, persistReport } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let report = null;
  try {
    report = await getLatestReport();
  } catch {
    // A transient database read error must never white-screen the judge demo.
    // Fall through to a fresh deterministic pipeline run below.
    report = null;
  }
  if (!report) {
    report = await runPipeline(undefined, dbMode());
    // Persistence is best-effort: if the write fails we still render the report.
    try {
      await persistReport(report);
    } catch {
      /* best-effort persistence; the report is already computed */
    }
  }
  return <ArchonDashboard initialReport={report} />;
}
