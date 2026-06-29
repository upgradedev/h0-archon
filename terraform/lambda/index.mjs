// archon-indexer — CQRS stream processor (DynamoDB Streams -> OpenSearch).
//
// Triggered by an aws_lambda_event_source_mapping on the h0-archon-reports
// table stream (NEW_AND_OLD_IMAGES). For each record we:
//   1. unmarshall the DynamoDB NewImage into a plain JS object;
//   2. project it into a flat, search-optimized document (REPORT or ACTIVITY);
//   3. index (REMOVE -> delete) it into OpenSearch over a SigV4-signed HTTPS
//      request — the document id is `<pk>#<sk>` so re-indexing is idempotent.
//
// Dependencies are ALL provided by the nodejs20.x managed runtime (AWS SDK v3 +
// @aws-crypto), so the deployment zip carries no node_modules. The Lambda's
// execution role grants es:ESHttpPost/ESHttpPut on the domain; the domain access
// policy allows the account root, which the role is part of.
//
// Env:
//   OPENSEARCH_ENDPOINT  e.g. search-archon-search-xxxx.eu-west-1.es.amazonaws.com
//   OPENSEARCH_INDEX     e.g. archon-reports

import { unmarshall } from "@aws-sdk/util-dynamodb";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";

const REGION = process.env.AWS_REGION || "eu-west-1";
const ENDPOINT = (process.env.OPENSEARCH_ENDPOINT || "").replace(/^https?:\/\//, "");
const INDEX = process.env.OPENSEARCH_INDEX || "archon-reports";

const signer = new SignatureV4({
  service: "es",
  region: REGION,
  credentials: defaultProvider(),
  sha256: Sha256,
});

// Build a flat search document from a stored DynamoDB item.
// REPORT items wrap the full AnalysisReport under `report`; ACTIVITY items wrap
// the AuditActivity under `activity`. We index only the fields worth searching
// or aggregating on — the source of truth stays in DynamoDB.
function project(image) {
  const id = `${image.pk}#${image.sk}`;
  const base = { id, type: image.pk, sk: image.sk, created_at: image.created_at };

  if (image.pk === "REPORT") {
    const event = image.report?.event ?? {};
    return {
      ...base,
      company: event.company ?? null,
      period: event.period ?? null, // YYYY-MM
      event_id: event.event_id ?? image.event_id ?? null,
      employee_count: event.employee_count ?? null,
      // `employer_cost_total` is THE accurate payroll cost (gross + employer IKA).
      employer_cost: event.employer_cost_total ?? null,
      bank_net_total: event.bank_net_total ?? null,
      gross_total: event.gross_total ?? null,
      cost_gap_amount: event.cost_gap_amount ?? null,
      cost_gap_pct: event.cost_gap_pct ?? null,
      // revenue / ebitda are not in the current model; kept optional for forward
      // compatibility with richer P&L line items.
      revenue: image.report?.revenue ?? null,
      ebitda: image.report?.ebitda ?? null,
      analysis_engine: image.report?.analysis_engine ?? null,
      executive_summary: image.report?.executive_summary ?? null,
    };
  }

  if (image.pk === "ACTIVITY") {
    return {
      ...base,
      kind: image.kind ?? image.activity?.kind ?? null, // intake | ask
      summary: image.summary ?? image.activity?.summary ?? null,
      activity_id: image.activity_id ?? null,
    };
  }

  // Unknown partition — index the raw shape so nothing is silently dropped.
  return { ...base, raw: image };
}

// Sign and send one HTTPS request to the OpenSearch domain.
async function osRequest(method, path, body) {
  const request = new HttpRequest({
    protocol: "https:",
    method,
    hostname: ENDPOINT,
    path,
    headers: {
      host: ENDPOINT,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const signed = await signer.sign(request);
  const url = `https://${ENDPOINT}${path}`;
  const res = await fetch(url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`OpenSearch ${method} ${path} -> ${res.status}: ${text}`);
  }
  return res;
}

export const handler = async (event) => {
  if (!ENDPOINT) throw new Error("OPENSEARCH_ENDPOINT is not set");

  for (const record of event.Records ?? []) {
    const keys = record.dynamodb?.Keys ? unmarshall(record.dynamodb.Keys) : {};
    const docId = encodeURIComponent(`${keys.pk}#${keys.sk}`);

    if (record.eventName === "REMOVE") {
      await osRequest("DELETE", `/${INDEX}/_doc/${docId}`);
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const doc = project(unmarshall(newImage));
    // PUT to a deterministic id => insert-or-replace (idempotent re-processing).
    await osRequest("PUT", `/${INDEX}/_doc/${docId}`, doc);
  }

  return { indexed: event.Records?.length ?? 0 };
};
