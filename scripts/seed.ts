import { dbMode, persistReport } from "../lib/db";
import { runPipeline } from "../lib/pipeline";

// Seed the active store (AWS DynamoDB when DYNAMODB_TABLE is set, otherwise the
// in-process demo store) with one finance-close report.
async function main() {
  const mode = dbMode();
  const report = await runPipeline(undefined, mode);
  await persistReport(report);
  console.log(`Seeded ${mode} with ${report.event.event_id}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
