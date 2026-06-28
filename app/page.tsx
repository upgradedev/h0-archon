import { ArchonDashboard } from "./components/ArchonDashboard";
import { dbMode } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { getOrCreateLatestReport } from "@/lib/report-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let report;
  try {
    report = await getOrCreateLatestReport();
  } catch {
    // A transient database error must never white-screen the judge demo:
    // fall back to a fresh, unpersisted deterministic run.
    report = await runPipeline(undefined, dbMode());
  }
  return <ArchonDashboard initialReport={report} />;
}
