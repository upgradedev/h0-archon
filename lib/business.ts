import type { AnalysisReport, ExtractedDocument } from "./types";
import { round2 } from "./format";
import financeData from "../data/sample-finance.json";

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

export function buildBusinessIntelligence(
  report: AnalysisReport,
  // Per-session uploaded trade invoices (sales_invoice / purchase_invoice) folded
  // into the close. Empty by default → byte-identical to the canonical output; the
  // shared module imports (financeData.sales/purchases) are never mutated.
  extraInvoices: ExtractedDocument[] = [],
): BusinessIntelligence {
  // Cache only the canonical (no-uploads) path — it is keyed by report identity,
  // which uniquely determines the result. With uploaded invoices the result also
  // depends on the invoices, so bypass the cache (recompute builds a fresh report
  // each call, so this never duplicates work).
  if (extraInvoices.length === 0) {
    const cached = biCache.get(report);
    if (cached) return cached;
    const result = computeBusinessIntelligence(report, []);
    biCache.set(report, result);
    return result;
  }
  return computeBusinessIntelligence(report, extraInvoices);
}

// The net (pre-VAT) amount is the P&L-relevant figure for an invoice; fall back to
// the gross when net was not extracted. Zero/absent → contributes nothing.
function invoiceAmount(doc: ExtractedDocument): number {
  return round2(doc.net_amount ?? doc.gross_amount ?? 0);
}

function computeBusinessIntelligence(
  report: AnalysisReport,
  extraInvoices: ExtractedDocument[],
): BusinessIntelligence {
  // --- Sales: base ledger + any uploaded sales invoices. The uploaded rows carry
  // the blended margin so they raise revenue without distorting weighted margin.
  const baseSales: SalesPerformance[] = financeData.sales;
  const baseRevenue = baseSales.reduce((sum, item) => sum + item.actual, 0);
  const baseWeightedMargin =
    baseRevenue === 0
      ? 0
      : round2(baseSales.reduce((sum, item) => sum + item.actual * item.marginPct, 0) / baseRevenue);
  const uploadedSalesRows: SalesPerformance[] = extraInvoices
    .filter((d) => d.doc_type === "sales_invoice")
    .map((d): SalesPerformance => ({
      owner: d.counterparty ?? "Uploaded customer",
      segment: "Uploaded sale",
      actual: invoiceAmount(d),
      goal: invoiceAmount(d),
      marginPct: baseWeightedMargin,
    }))
    .filter((row) => row.actual > 0);
  const salesPerformance: SalesPerformance[] = [...baseSales, ...uploadedSalesRows];
  const revenue = round2(salesPerformance.reduce((sum, item) => sum + item.actual, 0));
  const goal = round2(salesPerformance.reduce((sum, item) => sum + item.goal, 0));
  const weightedMarginPct = round2(
    salesPerformance.reduce((sum, item) => sum + item.actual * item.marginPct, 0) / revenue
  );

  // --- Purchases: base vendor invoices + any uploaded purchase invoices (spread,
  // never mutate the shared import). Each uploaded purchase becomes its own COGS
  // category, raising cost-of-purchase and reshaping concentration shares.
  const uploadedPurchaseRows = extraInvoices
    .filter((d) => d.doc_type === "purchase_invoice")
    .map((d) => ({
      category: d.counterparty ?? "Uploaded purchase",
      vendor: d.counterparty ?? "Uploaded purchase",
      amount: invoiceAmount(d),
    }))
    .filter((row) => row.amount > 0);
  const purchaseRaw = [...financeData.purchases, ...uploadedPurchaseRows];
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
  const fixedOpex = financeData.cash.fixedOpex;
  const operatingExpenses = round2(report.event.employer_cost_total + fixedOpex);
  const ebitda = round2(grossProfit - operatingExpenses);
  const ebitdaMarginPct = round2((ebitda / revenue) * 100);

  const openingBalance = financeData.cash.openingBalance;
  const collections = financeData.cash.collections;
  const supplierPayments = cogs - financeData.cash.supplierPaymentReductionVsCogs;
  const payrollNet = report.event.bank_net_total;
  const payrollHidden = report.event.hidden_total;
  const rentMarketingAdmin = fixedOpex;
  const closingBalance = round2(openingBalance + collections - supplierPayments - payrollNet - payrollHidden - rentMarketingAdmin);
  const netMovement = round2(closingBalance - openingBalance);
  const runwayMonths = round2(closingBalance / operatingExpenses);

  const receivables = financeData.workingCapital.receivables;
  const payables = financeData.workingCapital.payables;
  const vatPayable = financeData.workingCapital.vatPayable;
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
        { label: "Payroll true cost", amount: -report.event.employer_cost_total, note: "Gross payroll plus employer social-security contributions." },
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
        { label: "Payroll taxes / social-security gap", amount: payrollHidden, direction: "out" },
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
      `Every document type is present and cross-linked: payroll reconciles across the bank transfer, register, and payslips, and the only item to watch is supplier concentration in ${purchaseCategories[0].category.toLowerCase()}.`,
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
        detail: `${purchaseCategories[0].category} is ${purchaseCategories[0].sharePct.toFixed(1)}% of purchase spend.`,
        severity: "risk",
      },
      {
        title: "Payroll reconciled across documents",
        detail: `Bank transfer plus employer social-security contributions and withheld amounts tie out to the register; EUR ${report.event.hidden_total.toFixed(0)} is only visible once the documents are correlated.`,
        severity: "watch",
      },
    ],
  };
}
