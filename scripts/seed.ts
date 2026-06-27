import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { dbMode, persistReport } from "../lib/db";
import { runPipeline } from "../lib/pipeline";

async function main() {
  const mode = dbMode();

  if (mode !== "aurora-postgres") {
    const report = await runPipeline(undefined, mode);
    await persistReport(report);
    console.log(`Seeded ${mode} with ${report.event.event_id}.`);
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: false },
  });
  try {
    const schema = await readFile(join(process.cwd(), "db", "schema.sql"), "utf8");
    await pool.query(schema);
  } finally {
    await pool.end();
  }

  const report = await runPipeline(undefined, mode);
  await persistReport(report);
  console.log(`Seeded Aurora with ${report.event.event_id}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
