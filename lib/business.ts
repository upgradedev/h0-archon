import type { AnalysisReport } from "./types";
import { round2 } from "./format";

export interface PnlLine {
  label: string;
  amount: number;
  note: string;
}

export interface SalesPerformance {
  owner: string;
  segment: string;
  actual: number;
  goal: number;
  marginPct: number;
}

export interface PurchaseCategory {
  category: string;
  vendor: string;
  amount: number;
  sharePct: number;
  risk: "low" | "watch" | "high";
}

export interface BankMovement {
  label: string;
  amount: number;
  direction: "in" | "out" | "balance";
}

export interface BusinessIntelligence {
  pnl: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingExpenses: number;
    ebitda: number;
    ebitdaMarginPct: number;
    lines: PnlLine[];
  };
  cash: {
    openingBalance: number;
    closingBalance: number;
    netMovement: number;
    runwayMonths: number;
    movements: BankMovement[];
  };
  sales: {
    actual: number;
    goal: number;
    attainmentPct: number;
    weightedMarginPct: number;
    performance: SalesPerformance[];
  };
  purchases: {
    total: number;
    categories: PurchaseCategory[];
  };
  workingCapital: {
    receivables: number;
    payables: number;
    vatPayable: number;
    cashConversionGap: number;
  };
  brief: string;
  alerts: Array<{ title: string; detail: string; severity: "good" | "watch" | "risk" }>;
}

// buildBusinessIntelligence is pure; memoize by report identity so the several
// callers per request (citations, workflow steps, judge evidence, Q&A, UI rows)
// do not each recompute the full intelligence object.
const biCache = new WeakMap<AnalysisReport, BusinessIntelligence>();

export function buildBusinessIntelligence(report: AnalysisReport): BusinessIntelligence {
  const cached = biCache.get(report);
  if (cached) return cached;
  const result = computeBusinessIntelligence(report);
  biCache.set(report, result);
  return result;
}

function computeBusinessIntelligence(report: AnalysisReport): BusinessIntelligence {
  const salesPerformance: SalesPerformance[] = [
    { owner: "Eleni", segment: "Wholesale", actual: 42500, goal: 40000, marginPct: 32.4 },
    { owner: "Nikos", segment: "Retail", actual: 28300, goal: 32000, marginPct: 38.1 },
    { owner: "Dimitra", segment: "Catering", actual: 18400, goal: 22000, marginPct: 29.6 },
    { owner: "Sofia", segment: "Online", actual: 7600, goal: 6000, marginPct: 44.3 },
  ];
  const revenue = round2(salesPerformance.reduce((sum, item) => sum + item.actual, 0));
  const goal = round2(salesPerformance.reduce((sum, item) => sum + item.goal, 0));
  const weightedMarginPct = round2(
    salesPerformance.reduce((sum, item) => sum + item.actual * item.marginPct, 0) / revenue
  );

  const purchaseRaw = [
    { category: "Fresh produce", vendor: "Attica Growers Coop", amount: 24200 },
    { category: "Dairy", vendor: "Aegean Dairy SA", amount: 13100 },
    { category: "Packaging", vendor: "PackLine Hellas", amount: 6200 },
    { category: "Logistics", vendor: "Metro Freight", amount: 5100 },
    { category: "Utilities", vendor: "Energy and water", amount: 3300 },
    { category: "Other purchases", vendor: "Long tail vendors", amount: 4800 },
  ];
  const cogs = round2(purchaseRaw.reduce((sum, item) => sum + item.amount, 0));
  const purchaseCategories: PurchaseCategory[] = purchaseRaw.map((item) => {
    const sharePct = round2((item.amount / cogs) * 100);
    return {
      ...item,
      sharePct,
      risk: sharePct >= 35 ? "high" : sharePct >= 15 ? "watch" : "low",
    };
  });

  const grossProfit = round2(revenue - cogs);
  const grossMarginPct = round2((grossProfit / revenue) * 100);
  const fixedOpex = 4500 + 2800 + 2100 + 700;
  const operatingExpenses = round2(report.event.employer_cost_total + fixedOpex);
  const ebitda = round2(grossProfit - operatingExpenses);
  const ebitdaMarginPct = round2((ebitda / revenue) * 100);

  const openingBalance = 38400;
  const collections = 94200;
  const supplierPayments = cogs - 2100;
  const payrollNet = report.event.bank_net_total;
  const payrollHidden = report.event.hidden_total;
  const rentMarketingAdmin = fixedOpex;
  const closingBalance = round2(openingBalance + collections - supplierPayments - payrollNet - payrollHidden - rentMarketingAdmin);
  const netMovement = round2(closingBalance - openingBalance);
  const runwayMonths = round2(closingBalance / operatingExpenses);

  const receivables = 18600;
  const payables = 14200;
  const vatPayable = 5400;
  const cashConversionGap = round2(receivables - payables + vatPayable);

  return {
    pnl: {
      revenue,
      cogs,
      grossProfit,
      grossMarginPct,
      operatingExpenses,
      ebitda,
      ebitdaMarginPct,
      lines: [
        { label: "Net revenue", amount: revenue, note: "Sales invoices, POS, and e-commerce settlement." },
        { label: "Purchases / COGS", amount: -cogs, note: "Supplier ledger, vendor invoices, and bank outflows." },
        { label: "Gross profit", amount: grossProfit, note: `${grossMarginPct.toFixed(1)}% blended margin.` },
        { label: "Payroll true cost", amount: -report.event.employer_cost_total, note: "Gross payroll plus employer IKA." },
        { label: "Rent, marketing, admin", amount: -fixedOpex, note: "Recurring non-payroll operating expenses." },
        { label: "EBITDA", amount: ebitda, note: `${ebitdaMarginPct.toFixed(1)}% operating margin.` },
      ],
    },
    cash: {
      openingBalance,
      closingBalance,
      netMovement,
      runwayMonths,
      movements: [
        { label: "Opening bank balance", amount: openingBalance, direction: "balance" },
        { label: "Customer collections", amount: collections, direction: "in" },
        { label: "Supplier payments", amount: supplierPayments, direction: "out" },
        { label: "Payroll net transfers", amount: payrollNet, direction: "out" },
        { label: "Payroll taxes / IKA gap", amount: payrollHidden, direction: "out" },
        { label: "Rent, marketing, admin", amount: rentMarketingAdmin, direction: "out" },
        { label: "Closing bank balance", amount: closingBalance, direction: "balance" },
      ],
    },
    sales: {
      actual: revenue,
      goal,
      attainmentPct: round2((revenue / goal) * 100),
      weightedMarginPct,
      performance: salesPerformance,
    },
    purchases: {
      total: cogs,
      categories: purchaseCategories,
    },
    workingCapital: {
      receivables,
      payables,
      vatPayable,
      cashConversionGap,
    },
    brief: [
      `${report.event.company} generated EUR ${revenue.toFixed(0)} revenue in ${report.event.period}, reaching ${round2((revenue / goal) * 100).toFixed(1)}% of the sales goal.`,
      `The month is profitable: EBITDA is EUR ${ebitda.toFixed(0)} after true payroll cost, with a ${ebitdaMarginPct.toFixed(1)}% margin.`,
      `The main control risks are payroll understatement, catering underperformance, and supplier concentration in fresh produce.`,
    ].join(" "),
    alerts: [
      {
        title: "Profitability is positive",
        detail: `EBITDA margin is ${ebitdaMarginPct.toFixed(1)}% after full payroll cost.`,
        severity: "good",
      },
      {
        title: "Sales goal gap",
        detail: `Total sales are EUR ${(goal - revenue).toFixed(0)} below monthly goal.`,
        severity: "watch",
      },
      {
        title: "Supplier concentration",
        detail: `Fresh produce is ${purchaseCategories[0].sharePct.toFixed(1)}% of purchase spend.`,
        severity: "risk",
      },
      {
        title: "Payroll control gap",
        detail: `Bank-only payroll view misses EUR ${report.event.hidden_total.toFixed(0)} of monthly cost.`,
        severity: "risk",
      },
    ],
  };
}
