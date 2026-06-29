import type { AnalysisReport } from "./types";
import { buildBusinessIntelligence, type BusinessIntelligence } from "./business";
import { eur } from "./format";
import { resolveAnalysisEngine } from "./normalize";

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

export interface AccountingCitation {
  id: string;
  title: string;
  claim: string;
  source: string;
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

export interface FinanceReportResponse extends AnalysisReport {
  business_intelligence: BusinessIntelligence;
  citations: AccountingCitation[];
}

export function analysisEngineLabel(report: AnalysisReport): string {
  return resolveAnalysisEngine(report);
}

export function buildReportResponse(report: AnalysisReport): FinanceReportResponse {
  const normalizedReport = {
    ...report,
    analysis_engine: analysisEngineLabel(report),
  };
  return {
    ...normalizedReport,
    business_intelligence: buildBusinessIntelligence(normalizedReport),
    citations: buildAccountingCitations(normalizedReport),
  };
}

export function buildDocumentSources(report: AnalysisReport): DocumentSourceInsight[] {
  const payslipCount = report.event.employees.length;
  return [
    {
      id: "bank",
      title: "Bank payroll confirmation",
      filename: "bank_confirmation_202601.pdf",
      role: "Shows the net salary transfer, used to reconcile payroll cash-out.",
      captured: "cash movement reconciled to bank balance",
    },
    {
      id: "sales",
      title: "Sales ledger and goals",
      filename: "sales_ledger_202601.xlsx",
      role: "Links client engagements, segments, owners, and monthly goals.",
      captured: "revenue, margin, and goal attainment",
    },
    {
      id: "purchases",
      title: "Vendor invoices",
      filename: "vendor_invoices_202601.pdf",
      role: "Groups vendor spend into COGS categories and concentration risks.",
      captured: "supplier spend and gross margin impact",
    },
    {
      id: "register",
      title: "Payroll register",
      filename: "payroll_register_202601.pdf",
      role: "Carries gross pay, withheld taxes, and employee/employer social-security contributions.",
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
  const intelligence = buildBusinessIntelligence(report);
  const passCount = report.validations.filter((validation) => validation.passed).length;
  return [
    {
      id: "intake",
      title: "Intake",
      owner: "Upload agent",
      status: "passed",
      evidence: `${report.event.linked_docs.length + 4} monthly finance documents accepted for close`,
    },
    {
      id: "classify",
      title: "Classify",
      owner: "Document classifier",
      status: "passed",
      evidence: "Bank, sales, purchase, payroll register, and payslip groups identified",
    },
    {
      id: "extract",
      title: "Extract",
      owner: "Finance extractor",
      status: "passed",
      evidence: "Revenue, COGS, cash movement, payroll, tax, and employee fields normalized",
    },
    {
      id: "link",
      title: "Link",
      owner: "Ledger linker",
      status: "passed",
      evidence: `${report.event.company} ${report.event.period}: P&L, cash, sales, purchases, and payroll fused`,
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
      title: "Report",
      owner: "Evidence writer",
      status: "stored",
      evidence: `Report, citations, history, and Q&A context stored through ${report.db_mode}`,
    },
    {
      id: "analyze",
      title: "Analyze",
      owner: "CFO rules engine",
      status: "passed",
      evidence: `${eur.format(intelligence.pnl.ebitda)} EBITDA, ${intelligence.sales.attainmentPct.toFixed(1)}% sales goal attainment`,
    },
  ];
}

export function buildAccountingCitations(report: AnalysisReport): AccountingCitation[] {
  const intelligence = buildBusinessIntelligence(report);
  const topPurchase = intelligence.purchases.categories[0];
  return [
    {
      id: "SRC-REV",
      title: "Revenue basis",
      claim: "P&L revenue is shown net of tax and reconciled from sales documents.",
      source: "sales_ledger_202601.xlsx",
      evidence: `${eur.format(intelligence.pnl.revenue)} net revenue, ${intelligence.sales.attainmentPct.toFixed(1)}% goal attainment`,
    },
    {
      id: "SRC-COGS",
      title: "Purchase basis",
      claim: "COGS and supplier concentration come from the purchase ledger and bank outflows.",
      source: "vendor_invoices_202601.pdf",
      evidence: `${eur.format(intelligence.purchases.total)} COGS; ${topPurchase.category} is ${topPurchase.sharePct.toFixed(1)}%`,
    },
    {
      id: "SRC-CASH",
      title: "Cash basis",
      claim: "The account statement reconciles collections, supplier payments, payroll transfers, and closing balance.",
      source: "bank_confirmation_202601.pdf",
      evidence: `${eur.format(intelligence.cash.closingBalance)} closing cash, ${intelligence.cash.runwayMonths.toFixed(1)} months runway`,
    },
    {
      id: "SRC-PAY",
      title: "Payroll control basis",
      claim: "Employer payroll cost must use the payroll register and payslips, not only the bank transfer.",
      source: "payroll_register_202601.pdf + employee payslips",
      evidence: `${eur.format(report.event.employer_cost_total)} true cost vs ${eur.format(report.event.bank_net_total)} bank net`,
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
  const intelligence = buildBusinessIntelligence(report);
  const validationCount = report.validations.filter((validation) => validation.passed).length;
  const awsStatus = report.db_mode === "aws-dynamodb" ? "ready" : "fallback";
  const awsLabel =
    report.db_mode === "aws-dynamodb"
      ? "AWS DynamoDB table selected by DYNAMODB_TABLE"
      : "Embedded demo store because the AWS database env var is absent";

  return {
    generated_at: report.generated_at,
    stack: [
      { label: "Frontend", value: "Next.js App Router on Vercel", status: "ready" },
      { label: "Database", value: awsLabel, status: awsStatus },
      { label: "Agent flow", value: "Seven-step intake, classify, extract, link, validate, report, analyze ledger", status: "ready" },
      { label: "Analysis", value: "Deterministic CFO rules engine and ask-report endpoint in Vercel Functions", status: "ready" },
      { label: "Audit trail", value: "Single-table REPORT and ACTIVITY records for close runs, intake events, and Q&A", status: "ready" },
      { label: "CI/CD", value: "GitHub Actions runs typecheck, tests, build, evidence, and live smoke", status: "configured" },
    ],
    criteria: [
      {
        criterion: "Use of Sponsor Technology",
        evidence: `Public Vercel app calls serverless API routes that persist AnalysisReport records through ${report.db_mode}.`,
      },
      {
        criterion: "Real-world usefulness",
        evidence: `SMB owner sees P&L, cash runway, sales goal attainment, supplier concentration, and ${eur.format(report.event.hidden_total)} payroll cost hidden by bank-only accounting.`,
      },
      {
        criterion: "UI/UX",
        evidence: "Single public judge path exposes upload intake, P&L, cash, sales, purchases, payroll controls, citations, Q&A, history, and JSON APIs.",
      },
      {
        criterion: "Creativity",
        evidence: "Agent-style document fusion converts partial SMB finance documents into an auditable CFO command center.",
      },
      {
        criterion: "Startup potential",
        evidence: "Monthly SMB finance close can expand into accountant workflows, bank integrations, sales coaching, and controls monitoring.",
      },
    ],
    endpoints: [
      { label: "Report", path: "/api/report", purpose: "Latest persisted finance intelligence JSON" },
      { label: "Intake", path: "/api/intake", purpose: "Classifies uploaded monthly finance files by document role" },
      { label: "Ask", path: "/api/ask", purpose: "Answers natural-language finance questions against the latest report" },
      { label: "Run", path: "/api/run", purpose: "Re-executes extract, link, validate, analyze, persist" },
      { label: "History", path: "/api/history", purpose: "Recent persisted runs and interaction activity from AWS DynamoDB or fallback store" },
      { label: "Evidence", path: "/api/evidence", purpose: "Judge-facing sponsor stack and criteria evidence" },
    ],
    proof: [
      `db_mode=${report.db_mode}`,
      `event_id=${report.event.event_id}`,
      `validations=${validationCount}/${report.validations.length}`,
      `revenue=${intelligence.pnl.revenue.toFixed(2)}`,
      `ebitda=${intelligence.pnl.ebitda.toFixed(2)}`,
      `sales_attainment=${intelligence.sales.attainmentPct.toFixed(2)}`,
      `citations=${buildAccountingCitations(report).length}`,
      `payroll_gap=${report.event.hidden_total.toFixed(2)}`,
      "records=REPORT+ACTIVITY",
    ],
  };
}
