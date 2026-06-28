const defaultUrl = "https://h0-archon.vercel.app/api/report";
const liveUrl = process.env.H0_LIVE_URL || defaultUrl;
const attempts = Number(process.env.H0_LIVE_ATTEMPTS || 6);
const delayMs = Number(process.env.H0_LIVE_DELAY_MS || 10000);

type LiveReport = {
  db_mode?: string;
  generated_at?: string;
  event?: {
    employer_cost_total?: number;
    hidden_total?: number;
    cost_gap_pct?: number;
    employee_count?: number;
  };
  validations?: Array<{ rule?: string; passed?: boolean }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertLiveReport(report: LiveReport) {
  if (report.db_mode !== "aws-dynamodb") {
    throw new Error(`expected db_mode aws-dynamodb, got ${report.db_mode || "<missing>"}`);
  }
  if (!report.generated_at || Number.isNaN(Date.parse(report.generated_at))) {
    throw new Error("generated_at is missing or invalid");
  }
  if (report.event?.employer_cost_total !== 9110.62) {
    throw new Error(`unexpected employer_cost_total: ${report.event?.employer_cost_total}`);
  }
  if (report.event?.hidden_total !== 3153.95) {
    throw new Error(`unexpected hidden_total: ${report.event?.hidden_total}`);
  }
  if (report.event?.cost_gap_pct !== 27.88) {
    throw new Error(`unexpected cost_gap_pct: ${report.event?.cost_gap_pct}`);
  }
  if (report.event?.employee_count !== 5) {
    throw new Error(`unexpected employee_count: ${report.event?.employee_count}`);
  }

  const results = new Map((report.validations || []).map((result) => [result.rule, result.passed]));
  for (const rule of ["R1", "R2", "R3", "R4"]) {
    if (results.get(rule) !== true) {
      throw new Error(`validation ${rule} did not pass`);
    }
  }
}

async function fetchReport() {
  const response = await fetch(liveUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GET ${liveUrl} returned ${response.status}`);
  }
  return (await response.json()) as LiveReport;
}

async function main() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const report = await fetchReport();
      assertLiveReport(report);
      console.log(
        JSON.stringify(
          {
            ok: true,
            url: liveUrl,
            db_mode: report.db_mode,
            generated_at: report.generated_at,
            employer_cost_total: report.event?.employer_cost_total,
            hidden_total: report.event?.hidden_total,
            validations: report.validations?.map((result) => `${result.rule}:${result.passed ? "PASS" : "FAIL"}`),
          },
          null,
          2
        )
      );
      return;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
