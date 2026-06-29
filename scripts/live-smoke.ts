const defaultUrl = "https://h0-archon.vercel.app/api/report";
const liveUrl = process.env.H0_LIVE_URL || defaultUrl;
const appBaseUrl = liveUrl.replace(/\/api\/report\/?$/, "");
const attempts = Number(process.env.H0_LIVE_ATTEMPTS || 6);
const delayMs = Number(process.env.H0_LIVE_DELAY_MS || 10000);

type LiveReport = {
  db_mode?: string;
  analysis_engine?: string;
  generated_at?: string;
  business_intelligence?: {
    pnl?: { revenue?: number; ebitda?: number };
    sales?: { attainmentPct?: number };
  };
  citations?: Array<{ id?: string }>;
  event?: {
    employer_cost_total?: number;
    hidden_total?: number;
    cost_gap_pct?: number;
    employee_count?: number;
  };
  validations?: Array<{ rule?: string; passed?: boolean }>;
};

type IntakeResult = {
  accepted?: number;
  received?: number;
  coverage?: string[];
  ready_for_close?: boolean;
  activity_id?: string;
  persisted_via?: string;
};

type AskResult = {
  answer?: string;
  sources?: Array<{ id?: string }>;
  activity_id?: string;
  persisted_via?: string;
};

type HistoryResult = {
  count?: number;
  activity_count?: number;
  activity?: Array<{ activity_id?: string; kind?: string; db_mode?: string }>;
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
  if (report.analysis_engine !== "deterministic-finance-engine") {
    throw new Error(`unexpected analysis_engine: ${report.analysis_engine}`);
  }
  if (report.business_intelligence?.pnl?.revenue !== 47200) {
    throw new Error(`unexpected revenue: ${report.business_intelligence?.pnl?.revenue}`);
  }
  if (report.business_intelligence?.pnl?.ebitda !== 30697.55) {
    throw new Error(`unexpected ebitda: ${report.business_intelligence?.pnl?.ebitda}`);
  }
  if (report.business_intelligence?.sales?.attainmentPct !== 101.51) {
    throw new Error(`unexpected sales attainment: ${report.business_intelligence?.sales?.attainmentPct}`);
  }
  if ((report.citations || []).length !== 4) {
    throw new Error(`expected 4 citations, got ${(report.citations || []).length}`);
  }
  if (report.event?.employer_cost_total !== 6930) {
    throw new Error(`unexpected employer_cost_total: ${report.event?.employer_cost_total}`);
  }
  if (report.event?.hidden_total !== 2935.26) {
    throw new Error(`unexpected hidden_total: ${report.event?.hidden_total}`);
  }
  if (report.event?.cost_gap_pct !== 35.8) {
    throw new Error(`unexpected cost_gap_pct: ${report.event?.cost_gap_pct}`);
  }
  if (report.event?.employee_count !== 3) {
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

async function postIntake() {
  const form = new FormData();
  for (const name of [
    "bank_confirmation_202601.pdf",
    "sales_ledger_202601.xlsx",
    "vendor_purchases_202601.xlsx",
    "payroll_register_202601.pdf",
  ]) {
    form.append("files", new Blob(["judge smoke fixture"]), name);
  }
  const response = await fetch(`${appBaseUrl}/api/intake`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`POST /api/intake returned ${response.status}`);
  }
  const intake = (await response.json()) as IntakeResult;
  if (intake.accepted !== 4 || intake.received !== 4 || intake.ready_for_close !== true) {
    throw new Error(`unexpected intake result: ${JSON.stringify(intake)}`);
  }
  if (intake.persisted_via !== "aws-dynamodb" || !intake.activity_id) {
    throw new Error(`intake activity was not persisted in DynamoDB: ${JSON.stringify(intake)}`);
  }
  return intake;
}

async function postAsk() {
  const sampleResponse = await fetch(`${appBaseUrl}/api/ask`, {
    headers: { accept: "application/json" },
  });
  if (!sampleResponse.ok) {
    throw new Error(`GET /api/ask returned ${sampleResponse.status}`);
  }
  const sample = (await sampleResponse.json()) as AskResult;
  if (!sample.answer?.includes("True payroll cost") || (sample.sources || []).length !== 4) {
    throw new Error(`unexpected sample ask answer: ${JSON.stringify(sample)}`);
  }

  const response = await fetch(`${appBaseUrl}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "What is the true payroll cost versus the bank statement?" }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/ask returned ${response.status}`);
  }
  const answer = (await response.json()) as AskResult;
  if (!answer.answer?.includes("True payroll cost") || (answer.sources || []).length !== 4) {
    throw new Error(`unexpected ask answer: ${JSON.stringify(answer)}`);
  }
  if (answer.persisted_via !== "aws-dynamodb" || !answer.activity_id) {
    throw new Error(`ask activity was not persisted in DynamoDB: ${JSON.stringify(answer)}`);
  }
  return answer;
}

async function fetchHistory(intakeActivityId: string, askActivityId: string) {
  const response = await fetch(`${appBaseUrl}/api/history?limit=3&activity_limit=10`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GET /api/history returned ${response.status}`);
  }
  const history = (await response.json()) as HistoryResult;
  const ids = new Set((history.activity || []).map((activity) => activity.activity_id));
  if (!history.count || !history.activity_count || !ids.has(intakeActivityId) || !ids.has(askActivityId)) {
    throw new Error(`history did not include persisted activity: ${JSON.stringify(history)}`);
  }
  return history;
}

// Advisory search round-trip: reindex the OpenSearch read-model, then query it.
// Logs a clear PASS/FAIL but NEVER throws — the main smoke must not depend on it
// while the OpenSearch IAM grant is still pending (reindex/search return 403 until
// the grant is applied).
//
// HARD GATE: the OpenSearch CQRS read-model must round-trip end to end (SigV4 →
// index → query). The grant for the app principal is applied, so a failure here
// is a real regression (auth, index, or query broken) and must fail the smoke.
async function checkSearchRoundTrip(): Promise<void> {
  const reindexRes = await fetch(`${appBaseUrl}/api/search/reindex`, { method: "POST" });
  if (!reindexRes.ok) {
    throw new Error(`search-smoke: POST /api/search/reindex returned ${reindexRes.status}`);
  }
  const reindex = (await reindexRes.json()) as { indexed?: number };
  if (!reindex.indexed || reindex.indexed <= 0) {
    throw new Error(`search-smoke: reindex indexed ${reindex.indexed ?? 0} documents (expected > 0)`);
  }
  const searchRes = await fetch(`${appBaseUrl}/api/search?q=archon`, {
    headers: { accept: "application/json" },
  });
  if (!searchRes.ok) {
    throw new Error(`search-smoke: GET /api/search?q=archon returned ${searchRes.status}`);
  }
  const result = (await searchRes.json()) as { total?: number };
  console.log(
    `[search-smoke] PASS: reindexed ${reindex.indexed} docs; search "archon" returned ${result.total ?? 0} hits`,
  );
}

async function main() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const report = await fetchReport();
      assertLiveReport(report);
      const intake = await postIntake();
      const answer = await postAsk();
      const history = await fetchHistory(intake.activity_id || "", answer.activity_id || "");
      // Hard gate — fails the smoke (and the deploy) if live search is down.
      await checkSearchRoundTrip();
      console.log(
        JSON.stringify(
          {
            ok: true,
            url: liveUrl,
            db_mode: report.db_mode,
            analysis_engine: report.analysis_engine,
            generated_at: report.generated_at,
            revenue: report.business_intelligence?.pnl?.revenue,
            citations: report.citations?.length,
            employer_cost_total: report.event?.employer_cost_total,
            hidden_total: report.event?.hidden_total,
            validations: report.validations?.map((result) => `${result.rule}:${result.passed ? "PASS" : "FAIL"}`),
            intake_activity_id: intake.activity_id,
            ask_activity_id: answer.activity_id,
            activity_count: history.activity_count,
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
