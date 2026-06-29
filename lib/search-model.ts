// Search read-model — pure, dependency-free, server-importable.
//
// This is the QUERY side of a CQRS split. DynamoDB stays the source of truth and
// the deterministic engine computes every canonical figure; this module only
// shapes that data into flat, searchable documents and builds the OpenSearch
// query/response mapping. It is intentionally free of the OpenSearch client and
// AWS SDK so it can be unit-tested without a live domain (see tests/opensearch.test.ts).
//
// IMPORTANT: pure TypeScript — no "use client", no network, no client-only imports.
// OpenSearch is NEVER used to compute KPI tiles or canonical numbers; it powers
// search/exploration only.

import type { AnalysisReport, AuditActivity } from "./types";
import { buildDashboardVM } from "./dashboard-vm";
import { buildLedger } from "./demo-ledger";
import { formatEUR } from "./format";

// --- Document model --------------------------------------------------------

export type SearchDocType = "report" | "counterparty" | "employee" | "document" | "activity";

// One flat searchable record. Field names line up 1:1 with the index mapping in
// lib/opensearch.ts (keyword: type/id/company/period/counterparty/docType;
// text: title/summary/text; numeric: amount).
export interface SearchDoc {
  id: string; // stable — used as the OpenSearch _id so reindex is idempotent
  type: SearchDocType;
  title: string;
  summary?: string;
  text?: string;
  company?: string;
  period?: string;
  counterparty?: string;
  docType?: string;
  amount?: number;
}

// --- Result model (what the API + UI consume) ------------------------------

export interface SearchHit {
  id: string;
  type: SearchDocType;
  title: string;
  subtitle: string;
  snippet: string;
  amount?: number;
  period?: string;
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}

// Minimal shape of the OpenSearch _search response body we rely on. Kept here so
// the client wrapper can cast its loosely-typed response into something we own.
export interface SearchResponseBody {
  hits: {
    total: { value: number } | number;
    hits: Array<{
      _id: string;
      _score: number | null;
      _source: SearchDoc;
    }>;
  };
}

// --- helpers ---------------------------------------------------------------

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

// --- Document builders -----------------------------------------------------

// Map one persisted report into its full set of searchable documents:
// 1 report + N counterparties (customers + suppliers) + N employees + doc-type chips.
export function buildReportSearchDocs(report: AnalysisReport): SearchDoc[] {
  const vm = buildDashboardVM(report);
  const ledger = buildLedger(vm);
  const event = report.event;
  const docs: SearchDoc[] = [];

  // Report.
  docs.push({
    id: `report:${event.event_id}`,
    type: "report",
    title: `${event.company} — ${vm.period} close`,
    summary: `Revenue ${formatEUR(vm.pnl.revenue)} · EBITDA ${formatEUR(vm.pnl.ebitda)} · true employer cost ${formatEUR(event.employer_cost_total)}`,
    text: `${event.company} monthly finance close ${event.period}. Revenue, EBITDA, payroll employer cost, cash flow, cross-document validation.`,
    company: event.company,
    period: event.period,
    amount: vm.pnl.revenue,
  });

  // Counterparties — customers.
  for (const customer of ledger.customers) {
    docs.push({
      id: `cp:${event.period}:customer:${slug(customer.name)}`,
      type: "counterparty",
      title: customer.name,
      summary: `Customer · ${formatEUR(customer.total)} invoiced · ${formatEUR(customer.openBalance)} open`,
      text: `${customer.name} customer counterparty of ${event.company}`,
      company: event.company,
      period: event.period,
      counterparty: customer.name,
      docType: "customer",
      amount: customer.total,
    });
  }

  // Counterparties — suppliers.
  for (const supplier of ledger.suppliers) {
    docs.push({
      id: `cp:${event.period}:supplier:${slug(supplier.name)}`,
      type: "counterparty",
      title: supplier.name,
      summary: `Supplier · ${formatEUR(supplier.total)} spend · ${formatEUR(supplier.openBalance)} open`,
      text: `${supplier.name} supplier vendor counterparty of ${event.company}`,
      company: event.company,
      period: event.period,
      counterparty: supplier.name,
      docType: "supplier",
      amount: supplier.total,
    });
  }

  // Employees.
  for (const employee of vm.payroll.employees) {
    docs.push({
      id: `emp:${event.period}:${slug(employee.name)}`,
      type: "employee",
      title: employee.name,
      summary: `Employee · gross ${formatEUR(employee.gross)} · net ${formatEUR(employee.net)} · employer cost ${formatEUR(employee.employerCost)}`,
      text: `${employee.name} employee payroll at ${event.company}`,
      company: event.company,
      period: event.period,
      docType: "employee",
      amount: employee.employerCost,
    });
  }

  // Source documents present in this close (doc-type chips + invoice families).
  const docChips: { label: string; count: number }[] = vm.documentIntake.map((chip) => ({
    label: chip.label,
    count: chip.count,
  }));
  const customerInvoiceCount = ledger.customers.reduce((sum, c) => sum + c.invoices.length, 0);
  const supplierInvoiceCount = ledger.suppliers.reduce((sum, s) => sum + s.invoices.length, 0);
  if (customerInvoiceCount > 0) docChips.push({ label: "Sales invoices", count: customerInvoiceCount });
  if (supplierInvoiceCount > 0) docChips.push({ label: "Purchase invoices", count: supplierInvoiceCount });

  for (const chip of docChips) {
    docs.push({
      id: `doc:${event.period}:${slug(chip.label)}`,
      type: "document",
      title: chip.label,
      summary: `${chip.count} ${chip.label.toLowerCase()} linked in ${vm.period}`,
      text: `${chip.label} source document for ${event.company} ${event.period}`,
      company: event.company,
      period: event.period,
      docType: chip.label,
    });
  }

  return docs;
}

// Map one audit activity (intake / ask) into a searchable document.
export function buildActivitySearchDoc(activity: AuditActivity): SearchDoc {
  const title =
    activity.kind === "intake" ? "Document intake" : activity.kind === "ask" ? "Ask Archon" : activity.kind;
  return {
    id: `activity:${activity.activity_id}`,
    type: "activity",
    title,
    summary: activity.summary,
    text: `${activity.kind} ${activity.summary}`,
    docType: activity.kind,
  };
}

// Build every searchable document for a full backfill.
export function buildSearchDocs(input: {
  reports: AnalysisReport[];
  activities: AuditActivity[];
}): SearchDoc[] {
  const reportDocs = input.reports.flatMap(buildReportSearchDocs);
  const activityDocs = input.activities.map(buildActivitySearchDoc);
  return [...reportDocs, ...activityDocs];
}

// --- Query + response mapping ----------------------------------------------

export interface SearchQueryOpts {
  size?: number;
  types?: SearchDocType[];
}

// A multi_match (best_fields, boosted) for precision plus a fuzzy multi_match for
// typo tolerance — combined under should/minimum_should_match so either clause can
// surface a hit. An optional `types` filter narrows by document type.
export function buildSearchQuery(q: string, opts: SearchQueryOpts = {}): Record<string, unknown> {
  const query = q.trim();
  const filter =
    opts.types && opts.types.length > 0 ? [{ terms: { type: opts.types } }] : [];
  return {
    size: opts.size ?? 40,
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query,
              fields: ["title^3", "company^2", "counterparty^2", "summary^1.5", "text"],
              type: "best_fields",
              operator: "or",
            },
          },
          {
            multi_match: {
              query,
              fields: ["title^2", "company", "counterparty", "summary", "text"],
              type: "best_fields",
              fuzziness: "AUTO",
              prefix_length: 1,
            },
          },
        ],
        minimum_should_match: 1,
        filter,
      },
    },
  };
}

function subtitleFor(doc: SearchDoc): string {
  switch (doc.type) {
    case "counterparty":
      return titleCase(doc.docType ?? "Counterparty");
    case "document":
      return doc.docType ?? "Document";
    case "employee":
      return doc.company ? `${doc.company} · employee` : "Employee";
    case "report":
      return doc.period ? `Monthly close · ${doc.period}` : "Report";
    case "activity":
      return "Activity";
    default:
      return "";
  }
}

// Normalize a raw OpenSearch response body into the API/UI result shape.
export function mapSearchResponse(body: SearchResponseBody): SearchResult {
  const rawTotal = body.hits.total;
  const total = typeof rawTotal === "number" ? rawTotal : rawTotal.value;
  const hits = body.hits.hits.map((hit) => {
    const source = hit._source;
    return {
      id: source.id ?? hit._id,
      type: source.type,
      title: source.title,
      subtitle: subtitleFor(source),
      snippet: source.summary ?? "",
      amount: source.amount,
      period: source.period,
    };
  });
  return { total, hits };
}
