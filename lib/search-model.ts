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

import type { AnalysisReport } from "./types";
import { buildDashboardVM } from "./dashboard-vm";
import { buildBusinessIntelligence } from "./business";
import { buildLedger } from "./demo-ledger";
import { formatEUR } from "./format";
import financeData from "../data/sample-finance.json";

// --- Document model --------------------------------------------------------

// Search is DOCUMENTS-FIRST: the index holds only the things a user wants to FIND
// (source documents, vendors/customers, employees). The aggregated monthly close
// (type "report") and the "Ask Archon" / intake activity log are deliberately NOT
// indexed — they are noise for "find a document" and used to crowd out the real
// source documents. Canonical figures still come from the deterministic engine.
export type SearchDocType = "counterparty" | "employee" | "document";

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

// Initialism for a multi-word name ("Amazon Web Services" -> "AWS"). Indexing this
// alongside the full name lets short queries like "AWS" or "PPC" hit a vendor whose
// tokens ([amazon, web, services]) fuzziness alone could never bridge to. Returns ""
// for single-word names so we never inject a noise token.
function acronym(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) return "";
  return words.map((word) => word[0]).join("").toUpperCase();
}

// Real source filenames for the demo close, keyed by the document-intake label, so a
// filename search ("bank_confirmation_202601.pdf") resolves to the right document.
const DOC_FILENAMES: Record<string, string> = {
  "Bank confirmation": financeData.sources.bank,
  "Sales invoices": financeData.sources.sales,
  "Purchase invoices": financeData.sources.purchases,
};

// --- Document builders -----------------------------------------------------

// Map one persisted report into its full set of searchable DOCUMENTS-FIRST records:
// N counterparties (customers + suppliers) + N employees + doc-type/source chips.
// The aggregated close itself (type "report") is intentionally NOT emitted — search
// is for finding source documents, not the rolled-up close.
export function buildReportSearchDocs(report: AnalysisReport): SearchDoc[] {
  const vm = buildDashboardVM(report);
  const bi = buildBusinessIntelligence(report);
  const ledger = buildLedger(vm);
  const event = report.event;
  const docs: SearchDoc[] = [];

  // The supplier ledger is keyed by spend CATEGORY ("Cloud infrastructure"), so the
  // real vendor name ("Amazon Web Services") only lives on the purchases categories.
  // Index both, or a vendor-name query can never hit.
  const categoryToVendor = new Map<string, string>(
    bi.purchases.categories.map((c): [string, string] => [c.category, c.vendor]),
  );

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

  // Counterparties — suppliers. `supplier.name` is the spend CATEGORY; resolve the
  // real vendor and index both (plus the vendor initialism, so "AWS" hits "Amazon
  // Web Services"). The vendor leads the title since that is what a user searches for.
  for (const supplier of ledger.suppliers) {
    const category = supplier.name;
    const vendor = categoryToVendor.get(category) ?? category;
    const vendorAcronym = acronym(vendor);
    docs.push({
      id: `cp:${event.period}:supplier:${slug(category)}`,
      type: "counterparty",
      title: vendor,
      summary: `Supplier · ${category} · ${formatEUR(supplier.total)} spend · ${formatEUR(supplier.openBalance)} open`,
      text: `${vendor} ${vendorAcronym} ${category} supplier vendor counterparty of ${event.company}`,
      company: event.company,
      period: event.period,
      counterparty: vendor,
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
    const filename = DOC_FILENAMES[chip.label] ?? "";
    docs.push({
      id: `doc:${event.period}:${slug(chip.label)}`,
      type: "document",
      title: chip.label,
      summary: `${chip.count} ${chip.label.toLowerCase()} linked in ${vm.period}`,
      text: `${chip.label} ${filename} source document for ${event.company} ${event.period}`,
      company: event.company,
      period: event.period,
      docType: chip.label,
    });
  }

  return docs;
}

// Build every searchable document for a full backfill. Documents-first: only the
// document / counterparty / employee records are indexed (no report, no activity).
export function buildSearchDocs(reports: AnalysisReport[]): SearchDoc[] {
  return reports.flatMap(buildReportSearchDocs);
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
