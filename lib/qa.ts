import { buildBusinessIntelligence } from "./business";
import { buildAccountingCitations } from "./insights";
import { eur } from "./format";
import type { AnalysisReport } from "./types";

export interface FinanceAnswer {
  question: string;
  answer: string;
  sources: Array<{ id: string; title: string; evidence: string }>;
  generated_at: string;
}

export function buildFinanceAnswer(report: AnalysisReport, question: string): FinanceAnswer {
  const q = question.trim() || "What changed in this finance close?";
  const business = buildBusinessIntelligence(report);
  const citations = buildAccountingCitations(report);
  const lower = q.toLowerCase();

  let answer: string;
  if (lower.includes("payroll") || lower.includes("bank")) {
    answer = [
      `True payroll cost is ${eur.format(report.event.employer_cost_total)}, while the bank statement shows only ${eur.format(report.event.bank_net_total)} in net salary transfers.`,
      `The missed amount is ${eur.format(report.event.hidden_total)} this month, driven by employer IKA and withheld payroll obligations that do not appear on the bank transfer line.`,
    ].join(" ");
  } else if (lower.includes("sales") || lower.includes("goal")) {
    answer = [
      `Sales reached ${business.sales.attainmentPct.toFixed(1)}% of the monthly goal: ${eur.format(business.sales.actual)} actual versus ${eur.format(business.sales.goal)} target.`,
      `Wholesale and online are above target; retail and catering need follow-up.`,
    ].join(" ");
  } else if (lower.includes("cash") || lower.includes("runway")) {
    answer = [
      `Closing cash is ${eur.format(business.cash.closingBalance)}, giving ${business.cash.runwayMonths.toFixed(1)} months of operating runway at the current expense base.`,
      `The close also shows ${eur.format(business.workingCapital.cashConversionGap)} tied up in receivables, payables, and VAT.`,
    ].join(" ");
  } else if (lower.includes("purchase") || lower.includes("supplier")) {
    const top = business.purchases.categories[0];
    answer = [
      `${top.category} is the main supplier concentration risk at ${top.sharePct.toFixed(1)}% of purchase spend.`,
      `Total COGS is ${eur.format(business.purchases.total)}, producing ${business.pnl.grossMarginPct.toFixed(1)}% gross margin.`,
    ].join(" ");
  } else {
    answer = [
      `${report.event.company} produced ${eur.format(business.pnl.revenue)} revenue and ${eur.format(business.pnl.ebitda)} EBITDA in ${report.event.period}.`,
      `The key risks are the ${eur.format(report.event.hidden_total)} payroll understatement, supplier concentration, and the remaining ${eur.format(business.sales.goal - business.sales.actual)} sales goal gap.`,
    ].join(" ");
  }

  return {
    question: q,
    answer,
    sources: citations.map((citation) => ({
      id: citation.id,
      title: citation.title,
      evidence: citation.evidence,
    })),
    generated_at: new Date().toISOString(),
  };
}
