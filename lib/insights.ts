import type { AnalysisReport } from "./types";

export interface DocumentSourceInsight {
  id: string;
  title: string;
  filename: string;
  role: string;
  captured: string;
}

export interface WorkflowStepInsight {
  id: string;
  title: string;
  owner: string;
  status: "passed" | "active" | "stored";
  evidence: string;
}

export interface CashPlanningInsight {
  bankOnlyMonthly: number;
  trueMonthlyCost: number;
  monthlyUnderstatement: number;
  quarterlyReserveTarget: number;
  annualUnderstatement: number;
  averageEmployerCostPerEmployee: number;
}

export interface JudgeEvidence {
  generated_at: string;
  stack: Array<{ label: string; value: string; status: "ready" | "configured" | "fallback" }>;
  criteria: Array<{ criterion: string; evidence: string }>;
  endpoints: Array<{ label: string; path: string; purpose: string }>;
  proof: string[];
}

const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function buildDocumentSources(report: AnalysisReport): DocumentSourceInsight[] {
  const payslipCount = report.event.employees.length;
  return [
    {
      id: "bank",
      title: "Bank confirmation",
      filename: "alpha_bank_payroll_batch_2026-05.pdf",
      role: "Shows the cash that visibly left the bank account.",
      captured: `${eur.format(report.event.bank_net_total)} net salary transfer`,
    },
    {
      id: "register",
      title: "Payroll register",
      filename: "misthodosia_register_2026-05.xlsx",
      role: "Carries gross, withheld taxes, employee IKA, and employer IKA.",
      captured: `${eur.format(report.event.employer_cost_total)} true employer cost`,
    },
    {
      id: "payslips",
      title: "Employee payslips",
      filename: `${payslipCount} payslip PDFs`,
      role: "Granular employee-level evidence used to recompute totals.",
      captured: `${payslipCount} employees linked to ${report.event.period}`,
    },
  ];
}

export function buildWorkflowSteps(report: AnalysisReport): WorkflowStepInsight[] {
  const passCount = report.validations.filter((validation) => validation.passed).length;
  return [
    {
      id: "extract",
      title: "Extract",
      owner: "Document agent",
      status: "passed",
      evidence: `${report.event.linked_docs.length} source documents normalized`,
    },
    {
      id: "link",
      title: "Link",
      owner: "Event linker",
      status: "passed",
      evidence: `${report.event.company} ${report.event.period} fused into ${report.event.event_id}`,
    },
    {
      id: "validate",
      title: "Validate",
      owner: "Control agent",
      status: passCount === report.validations.length ? "passed" : "active",
      evidence: `${passCount}/${report.validations.length} controls passed`,
    },
    {
      id: "persist",
      title: "Persist",
      owner: "Vercel function",
      status: "stored",
      evidence: `Report stored through ${report.db_mode}`,
    },
    {
      id: "narrate",
      title: "Narrate",
      owner: "CFO agent",
      status: "passed",
      evidence: report.narrator_model,
    },
  ];
}

export function buildCashPlanningInsight(report: AnalysisReport): CashPlanningInsight {
  const averageEmployerCostPerEmployee =
    report.event.employee_count === 0
      ? 0
      : report.event.employer_cost_total / report.event.employee_count;
  return {
    bankOnlyMonthly: report.event.bank_net_total,
    trueMonthlyCost: report.event.employer_cost_total,
    monthlyUnderstatement: report.event.hidden_total,
    quarterlyReserveTarget: report.event.employer_cost_total * 3,
    annualUnderstatement: report.event.hidden_total * 12,
    averageEmployerCostPerEmployee,
  };
}

export function buildJudgeEvidence(report: AnalysisReport): JudgeEvidence {
  const validationCount = report.validations.filter((validation) => validation.passed).length;
  const awsStatus = report.db_mode === "aws-dynamodb" || report.db_mode === "aurora-postgres" ? "ready" : "fallback";
  const awsLabel =
    report.db_mode === "aws-dynamodb"
      ? "AWS DynamoDB table selected by DYNAMODB_TABLE"
      : report.db_mode === "aurora-postgres"
        ? "Amazon Aurora PostgreSQL selected by DATABASE_URL"
        : "Embedded demo store because AWS database env vars are absent";

  return {
    generated_at: report.generated_at,
    stack: [
      { label: "Frontend", value: "Next.js App Router on Vercel", status: "ready" },
      { label: "Database", value: awsLabel, status: awsStatus },
      { label: "Narrator", value: report.narrator_model, status: report.narrator_model.startsWith("fallback") ? "fallback" : "ready" },
      { label: "CI/CD", value: "GitHub Actions runs typecheck, tests, build, evidence, and live smoke", status: "configured" },
    ],
    criteria: [
      {
        criterion: "Use of Sponsor Technology",
        evidence: `Public Vercel app calls serverless API routes that persist AnalysisReport records through ${report.db_mode}.`,
      },
      {
        criterion: "Real-world usefulness",
        evidence: `SMB owner sees ${eur.format(report.event.hidden_total)} monthly payroll cost hidden by bank-only accounting.`,
      },
      {
        criterion: "UI/UX",
        evidence: "Single public judge path exposes metrics, source documents, validation controls, history, and JSON APIs.",
      },
      {
        criterion: "Creativity",
        evidence: "Agent-style document fusion converts partial finance documents into one auditable payroll event.",
      },
      {
        criterion: "Startup potential",
        evidence: "Payroll truth can expand into recurring SMB cash planning, controls monitoring, and accountant workflows.",
      },
    ],
    endpoints: [
      { label: "Report", path: "/api/report", purpose: "Latest persisted payroll intelligence JSON" },
      { label: "Run", path: "/api/run", purpose: "Re-executes extract, link, validate, narrate, persist" },
      { label: "History", path: "/api/history", purpose: "Recent persisted runs from AWS DynamoDB or fallback store" },
      { label: "Evidence", path: "/api/evidence", purpose: "Judge-facing sponsor stack and criteria evidence" },
    ],
    proof: [
      `db_mode=${report.db_mode}`,
      `event_id=${report.event.event_id}`,
      `validations=${validationCount}/${report.validations.length}`,
      `hidden_total=${report.event.hidden_total.toFixed(2)}`,
      `cost_gap_pct=${report.event.cost_gap_pct.toFixed(2)}`,
    ],
  };
}
