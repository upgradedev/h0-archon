// Deterministic AR/AP transaction ledger derived from a DashboardVM.
//
// The dashboard aggregates (revenue, COGS, receivables, payables) are the source
// of truth. This module "un-aggregates" them into a plausible per-counterparty
// invoice ledger that RECONCILES back to those aggregates by construction:
//
//   • customer invoice totals sum EXACTLY to revenue   (= vm.pnl Revenue line)
//   • supplier invoice totals sum EXACTLY to COGS       (= vm.pnl COGS line)
//   • customer open balances sum ≈ receivables          (within a few %)
//   • supplier open balances sum ≈ payables             (within a few %)
//
// Everything is pure + deterministic — no Date.now / Math.random. Dates are
// derived from the period string + row index, amounts from fixed fractions, and
// the paid/open split from a global error-feedback greedy that drives the running
// open balance toward the receivables/payables target. Because it is pure and
// server-importable, it carries NO "use client" directive.

import type { DashboardVM } from "./dashboard-vm";
import { round2 } from "./format";

export type TxnStatus = "paid" | "open";

export interface Txn {
  id: string;
  date: string; // ISO yyyy-mm-dd, within the VM's period month
  description: string;
  amount: number; // gross invoice value, positive
  status: TxnStatus;
}

export interface Account {
  name: string;
  kind: "customer" | "supplier";
  invoices: Txn[];
  total: number; // sum of invoice amounts
  openBalance: number; // sum of `open` invoice amounts
  paidCount: number; // number of `paid` invoices
}

export interface Ledger {
  customers: Account[];
  suppliers: Account[];
  arTotal: number; // = revenue
  apTotal: number; // = COGS
  arOpen: number; // ≈ receivables
  apOpen: number; // ≈ payables
}

// --- helpers ---------------------------------------------------------------

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Parse a (possibly prettified or scaled) period label into {year, month}.
// Handles "May 2026", "Jan 2026", and falls back to 2026-05 for the aggregate
// label ("Jan–May 2026 (all)") or any unparseable string.
function parsePeriod(period: string): { year: number; month: number } {
  const yearMatch = /(\d{4})/.exec(period);
  const year = yearMatch ? Number(yearMatch[1]) : 2026;
  const lower = period.toLowerCase();
  let month = 5; // default May (canonical)
  for (let i = 0; i < MONTHS.length; i++) {
    if (lower.includes(MONTHS[i].slice(0, 3))) {
      month = i + 1;
      break;
    }
  }
  return { year, month };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const pad3 = (n: number): string => String(n).padStart(3, "0");

// Deterministic day-of-month from a row index, kept inside 1..28 so every month
// is valid. Spreads invoices across the month without any randomness.
function dateFor(year: number, month: number, index: number): string {
  const day = ((index * 5 + 4) % 28) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Initials/abbreviation from a counterparty name: "Fresh produce" -> "FP",
// "Masoutis Retail" -> "MR", "Dairy" -> "D".
function abbrev(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4) || "X"
  );
}

// Fixed deterministic splits. The rounding remainder is folded into the first
// invoice so the parts always sum EXACTLY to the requested total.
const FRACTIONS: Record<number, number[]> = {
  1: [1],
  2: [0.6, 0.4],
  3: [0.5, 0.3, 0.2],
};

function splitAmounts(total: number, parts: number): number[] {
  const fractions = FRACTIONS[parts] ?? FRACTIONS[1];
  const amounts = fractions.map((f) => round2(total * f));
  const sum = amounts.reduce((s, a) => s + a, 0);
  amounts[0] = round2(amounts[0] + (total - sum));
  return amounts;
}

// Build the invoice rows for one account (statuses defaulted to "paid" — the
// paid/open split is decided later, globally, by markOpen).
function buildInvoices(
  name: string,
  kind: Account["kind"],
  total: number,
  parts: number,
  accIdx: number,
  period: string,
): Txn[] {
  const { year, month } = parsePeriod(period);
  const ab = abbrev(name);
  const prefix = kind === "customer" ? "AR" : "AP";
  const amounts = splitAmounts(total, parts);
  return amounts.map((amount, seq) => ({
    id: `${prefix}-${ab}-${pad3(accIdx)}-${pad3(seq + 1)}`,
    date: dateFor(year, month, accIdx * 3 + seq),
    description: `Invoice INV-${ab}-${pad3(seq + 1)}`,
    amount,
    status: "paid" as TxnStatus,
  }));
}

// Choose the subset of an account's invoices to mark "open" whose summed value
// is closest to `desiredOpen`. Returns a bitmask. Deterministic tie-break:
// fewer open invoices, then smaller open sum, then smaller mask.
function bestOpenMask(invoices: Txn[], desiredOpen: number): number {
  const n = invoices.length;
  let bestMask = 0;
  let bestDist = Infinity;
  let bestCount = Infinity;
  let bestSum = Infinity;
  for (let mask = 0; mask < 1 << n; mask++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += invoices[i].amount;
        count += 1;
      }
    }
    const dist = Math.abs(sum - desiredOpen);
    const better =
      dist < bestDist - 1e-9 ||
      (Math.abs(dist - bestDist) <= 1e-9 &&
        (count < bestCount ||
          (count === bestCount && sum < bestSum - 1e-9) ||
          (count === bestCount && Math.abs(sum - bestSum) <= 1e-9 && mask < bestMask)));
    if (better) {
      bestMask = mask;
      bestDist = dist;
      bestCount = count;
      bestSum = sum;
    }
  }
  return bestMask;
}

// Decide paid/open across all accounts so the SUM of open balances approximates
// `targetOpen`. Global error-feedback greedy: at each account we steer the
// running open balance toward `ratio * runningTotal`, so accumulated rounding
// from earlier accounts is corrected by later ones. Mutates the accounts.
function markOpen(accounts: Account[], targetOpen: number, grandTotal: number): void {
  const ratio = grandTotal <= 0 ? 0 : Math.min(1, Math.max(0, targetOpen / grandTotal));
  let runningOpen = 0;
  let runningTotal = 0;
  for (const acc of accounts) {
    const desiredCumulative = ratio * (runningTotal + acc.total);
    const desiredForAcc = Math.min(acc.total, Math.max(0, desiredCumulative - runningOpen));
    const mask = bestOpenMask(acc.invoices, desiredForAcc);
    let open = 0;
    let paid = 0;
    acc.invoices.forEach((inv, i) => {
      if (mask & (1 << i)) {
        inv.status = "open";
        open += inv.amount;
      } else {
        inv.status = "paid";
        paid += 1;
      }
    });
    acc.openBalance = round2(open);
    acc.paidCount = paid;
    runningOpen += open;
    runningTotal += acc.total;
  }
}

// Extract the canonical revenue / COGS off the P&L waterfall. COGS is stored as a
// negative "subtract" step, so its magnitude is the cost.
function revenueOf(vm: DashboardVM): number {
  return round2(vm.pnl.find((s) => s.name === "Revenue")?.value ?? 0);
}
function cogsOf(vm: DashboardVM): number {
  return round2(Math.abs(vm.pnl.find((s) => s.name === "COGS")?.value ?? 0));
}

// Fixed customer roster (Greek SMB names) + revenue distribution weights.
// Weights sum to 1 so customer totals sum exactly to revenue.
const CUSTOMER_ROSTER: { name: string; weight: number }[] = [
  { name: "Masoutis Retail", weight: 0.27 },
  { name: "Sklavenitis Group", weight: 0.21 },
  { name: "Ouzeri To Limani", weight: 0.17 },
  { name: "Hotel Aegeon", weight: 0.14 },
  { name: "Kafe Nostos", weight: 0.12 },
  { name: "Deli Ermou", weight: 0.09 },
];

// Invoice count by rank (after sorting by total desc): the two largest accounts
// split into 2 invoices, the smaller ones into 3. Giving the smaller accounts —
// which markOpen processes LAST — finer granularity lets the running open balance
// converge tightly onto the receivables / payables target.
function partsForRank(rank: number): number {
  return rank < 2 ? 2 : 3;
}

function buildAccounts(
  raw: { name: string; total: number }[],
  kind: Account["kind"],
  targetTotal: number,
  period: string,
): Account[] {
  // Sort by total desc first so rank-based invoice counts and the remainder fold
  // are deterministic.
  const ordered = [...raw].sort((a, b) => b.total - a.total);

  // Reconcile the grand total EXACTLY: fold any rounding remainder into the
  // largest (first) account so the sum of account totals === targetTotal.
  const totals = ordered.map((r) => round2(r.total));
  const sum = totals.reduce((s, t) => s + t, 0);
  if (totals.length > 0) {
    totals[0] = round2(totals[0] + (targetTotal - sum));
  }

  return ordered.map((r, i) => {
    const total = totals[i];
    const invoices = buildInvoices(r.name, kind, total, partsForRank(i), i, period);
    return { name: r.name, kind, invoices, total, openBalance: 0, paidCount: invoices.length };
  });
}

export function buildLedger(vm: DashboardVM): Ledger {
  const period = vm.period;
  const arTotal = revenueOf(vm);
  const apTotal = cogsOf(vm);
  const receivables = round2(vm.workingCapital.receivables.value);
  const payables = round2(vm.workingCapital.payables.value);

  // --- Customers: distribute revenue by fixed weights.
  const customerRaw = CUSTOMER_ROSTER.map((c) => ({
    name: c.name,
    total: round2(arTotal * c.weight),
  }));
  const customers = buildAccounts(customerRaw, "customer", arTotal, period);

  // --- Suppliers: derive from the VM's supplier spend (which equals COGS).
  const supplierRaw = vm.suppliers.map((s) => ({
    name: s.name,
    total: round2(s.spend),
  }));
  const suppliers = buildAccounts(supplierRaw, "supplier", apTotal, period);

  // --- Paid/open split, reconciling to receivables / payables.
  markOpen(customers, receivables, arTotal);
  markOpen(suppliers, payables, apTotal);

  const arOpen = round2(customers.reduce((s, a) => s + a.openBalance, 0));
  const apOpen = round2(suppliers.reduce((s, a) => s + a.openBalance, 0));

  return { customers, suppliers, arTotal, apTotal, arOpen, apOpen };
}
