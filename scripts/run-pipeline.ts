import { dbMode, persistReport } from "../lib/db";
import { runPipeline } from "../lib/pipeline";

async function main() {
  const report = await runPipeline(undefined, dbMode());
  await persistReport(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
