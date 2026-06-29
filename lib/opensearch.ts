// Amazon OpenSearch client — the query side of the CQRS read-model.
//
// SERVER-ONLY. This module instantiates the OpenSearch client (SigV4-signed via
// the app's AWS credentials) and must never be imported by a client component —
// the search UI calls the /api/search route, it does not import this file. The
// pure document/query builders live in lib/search-model.ts so they can be unit
// tested without the live domain or the heavy AWS/OpenSearch deps.
//
// OpenSearch is used for search/exploration ONLY. The deterministic engine still
// computes every canonical figure and DynamoDB remains the source of truth.

import { Client } from "@opensearch-project/opensearch";
import type { API } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import type { AnalysisReport, AuditActivity } from "./types";
import {
  buildActivitySearchDoc,
  buildReportSearchDocs,
  buildSearchDocs,
  buildSearchQuery,
  mapSearchResponse,
  type SearchDoc,
  type SearchQueryOpts,
  type SearchResponseBody,
  type SearchResult,
} from "./search-model";

function indexName(): string {
  return process.env.OPENSEARCH_INDEX || "archon";
}

// True when the search read-model is wired (endpoint configured). Callers guard
// with this so the app degrades gracefully when OpenSearch is absent.
export function osConfigured(): boolean {
  return Boolean(process.env.OPENSEARCH_ENDPOINT);
}

let cachedClient: Client | null = null;

function osClient(): Client {
  if (cachedClient) return cachedClient;
  const node = process.env.OPENSEARCH_ENDPOINT;
  if (!node) throw new Error("OPENSEARCH_ENDPOINT is not configured");
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1";
  cachedClient = new Client({
    ...AwsSigv4Signer({
      region,
      service: "es", // managed OpenSearch domain (not serverless 'aoss')
      getCredentials: async () => {
        // defaultProvider() reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and
        // any other standard source). The domain access policy grants es:* to the
        // account root, so the app's own credentials authenticate via SigV4.
        const credentials = await defaultProvider()();
        return {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          sessionToken: credentials.sessionToken,
          expiration: credentials.expiration,
        };
      },
    }),
    node,
  });
  return cachedClient;
}

const INDEX_MAPPING = {
  mappings: {
    properties: {
      type: { type: "keyword" },
      id: { type: "keyword" },
      company: { type: "keyword" },
      period: { type: "keyword" },
      counterparty: { type: "keyword" },
      docType: { type: "keyword" },
      title: { type: "text" },
      summary: { type: "text" },
      text: { type: "text" },
      amount: { type: "double" },
    },
  },
};

// Create the index with its mapping if it does not already exist. Idempotent and
// tolerant of a concurrent creation race.
export async function ensureIndex(): Promise<void> {
  const client = osClient();
  const index = indexName();
  const exists = await client.indices.exists({ index });
  if (exists.body) return;
  try {
    // Cast the literal mapping to the generated request-body type (the property
    // `type` literals widen to `string` in a plain const, which the discriminated
    // Property union would otherwise reject).
    await client.indices.create({
      index,
      body: INDEX_MAPPING as unknown as API.Indices_Create_RequestBody,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("resource_already_exists_exception")) throw err;
  }
}

// Bulk-index documents using each doc's stable id as the _id (so re-running the
// backfill upserts rather than duplicates). Returns the number of docs indexed.
export async function bulkIndex(docs: SearchDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  const client = osClient();
  const index = indexName();
  const body = docs.flatMap((doc) => [{ index: { _index: index, _id: doc.id } }, doc]);
  const response = await client.bulk({
    refresh: true,
    body: body as unknown as API.Bulk_RequestBody,
  });
  if (response.body.errors) {
    const items = response.body.items as unknown as Array<Record<string, { error?: unknown }>>;
    const firstError = items.map((item) => Object.values(item)[0]?.error).find(Boolean);
    throw new Error(`OpenSearch bulk index failed: ${JSON.stringify(firstError)}`);
  }
  return docs.length;
}

// Run a search. Returns an empty result for a blank query (never hits the domain).
export async function search(q: string, opts: SearchQueryOpts = {}): Promise<SearchResult> {
  const trimmed = q.trim();
  if (!trimmed) return { total: 0, hits: [] };
  const client = osClient();
  const response = await client.search({
    index: indexName(),
    body: buildSearchQuery(trimmed, opts) as unknown as API.Search_RequestBody,
  });
  return mapSearchResponse(response.body as unknown as SearchResponseBody);
}

// Full backfill: ensure the index then bulk-index every report + activity doc.
export async function reindexAll(
  reports: AnalysisReport[],
  activities: AuditActivity[],
): Promise<number> {
  await ensureIndex();
  return bulkIndex(buildSearchDocs({ reports, activities }));
}

// Best-effort on-write indexing. Swallows all errors so a search outage can never
// break the write path. Callers should still guard the dynamic import with the
// OPENSEARCH_ENDPOINT env so this module is not loaded when the feature is off.
export async function indexReportBestEffort(report: AnalysisReport): Promise<void> {
  if (!osConfigured()) return;
  try {
    await ensureIndex();
    await bulkIndex(buildReportSearchDocs(report));
  } catch {
    // best-effort: search is a read-model, never the source of truth
  }
}

export async function indexActivityBestEffort(activity: AuditActivity): Promise<void> {
  if (!osConfigured()) return;
  try {
    await ensureIndex();
    await bulkIndex([buildActivitySearchDoc(activity)]);
  } catch {
    // best-effort
  }
}
