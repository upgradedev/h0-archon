import { ArchonDashboard } from "./components/ArchonDashboard";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const report = await runPipeline();
  return <ArchonDashboard initialReport={report} />;
}
