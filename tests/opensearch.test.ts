import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { extract, linkEvent, validate } from "../lib/pipeline";
import type { AnalysisReport, AuditActivity } from "../lib/types";
import {
  buildActivitySearchDoc,
  buildReportSearchDocs,
  buildSearchDocs,
  buildSearchQuery,
  mapSearchResponse,
  type SearchDoc,
  type SearchResponseBody,
} from "../lib/search-model";

function fixtureReport(): AnalysisReport {
  const docs = extract(samplePayroll);
  const event = linkEvent(docs);
  return {
    event,
    validations: validate(event, docs),
    executive_summary: "Fixture.",
    analysis_engine: "deterministic-finance-engine",
    generated_at: "2026-06-28T06:00:00.000Z",
    db_mode: "aws-dynamodb",
  };
}

function fixtureActivity(): AuditActivity {
  return {
    activity_id: "act-001",
    kind: "intake",
    summary: "5/5 uploaded finance documents classified",
    details: {},
    created_at: "2026-06-28T06:00:00.000Z",
    db_mode: "aws-dynamodb",
  };
}

describe("buildReportSearchDocs", () => {
  it("emits exactly one report doc with a stable id and the canonical revenue", () => {
    const report = fixtureReport();
    const docs = buildReportSearchDocs(report);
    const reportDocs = docs.filter((d) => d.type === "report");
    assert.equal(reportDocs.length, 1);
    const doc = reportDocs[0];
    assert.equal(doc.id, `report:${report.event.event_id}`);
    assert.equal(doc.company, report.event.company);
    assert.equal(doc.period, report.event.period);
    assert.equal(doc.amount, 47200); // canonical revenue
    assert.ok(doc.title.includes(report.event.company));
    assert.ok((doc.summary ?? "").length > 0);
  });

  it("emits one employee doc per payslip, keyed by period+name", () => {
    const report = fixtureReport();
    const docs = buildReportSearchDocs(report);
    const employeeDocs = docs.filter((d) => d.type === "employee");
    assert.equal(employeeDocs.length, report.event.employees.length);
    for (const doc of employeeDocs) {
      assert.ok(doc.id.startsWith(`emp:${report.event.period}:`));
      assert.equal(doc.docType, "employee");
      assert.equal(typeof doc.amount, "number");
    }
  });

  it("emits counterparty docs for both customers and suppliers", () => {
    const docs = buildReportSearchDocs(fixtureReport());
    const counterparties = docs.filter((d) => d.type === "counterparty");
    const kinds = new Set(counterparties.map((d) => d.docType));
    assert.ok(counterparties.length > 0);
    assert.ok(kinds.has("customer"));
    assert.ok(kinds.has("supplier"));
    for (const doc of counterparties) {
      assert.ok(doc.id.startsWith(`cp:${"2026-01"}:`));
      assert.equal(typeof doc.counterparty, "string");
    }
  });

  it("emits document docs including the source-doc families", () => {
    const docs = buildReportSearchDocs(fixtureReport());
    const documents = docs.filter((d) => d.type === "document");
    const titles = documents.map((d) => d.title);
    assert.ok(documents.length > 0);
    assert.ok(titles.includes("Bank confirmation"));
    assert.ok(titles.includes("Payroll register"));
    assert.ok(titles.some((t) => t.includes("invoices")));
  });

  it("indexes the real vendor name and its initialism on supplier docs", () => {
    // Regression: suppliers were indexed by spend CATEGORY only, so vendor-name
    // queries ("Anthropic", "AWS") returned nothing. Both the full vendor name and a
    // generated initialism must be searchable.
    const docs = buildReportSearchDocs(fixtureReport());
    const suppliers = docs.filter((d) => d.type === "counterparty" && d.docType === "supplier");
    const blob = suppliers.map((d) => `${d.title} ${d.text ?? ""}`).join(" ");
    assert.ok(blob.includes("Amazon Web Services"), "full vendor name indexed");
    assert.ok(blob.includes("AWS"), "vendor initialism indexed (AWS -> Amazon Web Services)");
    assert.ok(blob.includes("Anthropic"), "second vendor indexed");
    // The vendor leads the title so a hit reads as the vendor, not the category.
    assert.ok(suppliers.some((d) => d.title === "Amazon Web Services"));
  });

  it("produces unique, stable ids across the whole doc set", () => {
    const docs = buildReportSearchDocs(fixtureReport());
    const ids = docs.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("buildActivitySearchDoc / buildSearchDocs", () => {
  it("maps an activity into a searchable doc", () => {
    const doc = buildActivitySearchDoc(fixtureActivity());
    assert.equal(doc.id, "activity:act-001");
    assert.equal(doc.type, "activity");
    assert.equal(doc.docType, "intake");
    assert.equal(doc.title, "Document intake");
  });

  it("combines report and activity docs in one backfill set", () => {
    const docs = buildSearchDocs({ reports: [fixtureReport()], activities: [fixtureActivity()] });
    assert.ok(docs.some((d) => d.type === "report"));
    assert.ok(docs.some((d) => d.type === "activity"));
  });
});

describe("buildSearchQuery", () => {
  type Query = {
    size: number;
    query: {
      bool: {
        should: Array<{ multi_match: { fields: string[]; fuzziness?: string } }>;
        minimum_should_match: number;
        filter: unknown[];
      };
    };
  };

  it("builds a boosted multi_match plus a fuzzy multi_match", () => {
    const query = buildSearchQuery("masoutis") as unknown as Query;
    assert.equal(query.size, 40);
    const bool = query.query.bool;
    assert.equal(bool.should.length, 2);
    assert.equal(bool.minimum_should_match, 1);
    // First clause is precision-boosted; second adds typo tolerance.
    assert.ok(bool.should[0].multi_match.fields.includes("title^3"));
    assert.equal(bool.should[1].multi_match.fuzziness, "AUTO");
    assert.deepEqual(bool.filter, []);
  });

  it("adds a type filter when types are provided", () => {
    const query = buildSearchQuery("acme", { types: ["counterparty"], size: 10 }) as unknown as Query;
    assert.equal(query.size, 10);
    assert.deepEqual(query.query.bool.filter, [{ terms: { type: ["counterparty"] } }]);
  });
});

describe("mapSearchResponse", () => {
  function bodyFor(sources: SearchDoc[]): SearchResponseBody {
    return {
      hits: {
        total: { value: sources.length },
        hits: sources.map((source, i) => ({ _id: source.id, _score: 1 - i * 0.1, _source: source })),
      },
    };
  }

  it("maps total and derives subtitles per type", () => {
    const docs = buildReportSearchDocs(fixtureReport());
    const sample = [
      docs.find((d) => d.type === "report")!,
      docs.find((d) => d.type === "counterparty" && d.docType === "customer")!,
      docs.find((d) => d.type === "document")!,
    ];
    const result = mapSearchResponse(bodyFor(sample));
    assert.equal(result.total, 3);
    assert.equal(result.hits.length, 3);

    const customerHit = result.hits.find((h) => h.type === "counterparty");
    assert.equal(customerHit?.subtitle, "Customer");

    const reportHit = result.hits.find((h) => h.type === "report");
    assert.ok((reportHit?.subtitle ?? "").startsWith("Monthly close · "));
  });

  it("handles a numeric total shape", () => {
    const docs = buildReportSearchDocs(fixtureReport());
    const body: SearchResponseBody = {
      hits: { total: 1, hits: [{ _id: docs[0].id, _score: 1, _source: docs[0] }] },
    };
    const result = mapSearchResponse(body);
    assert.equal(result.total, 1);
  });
});
