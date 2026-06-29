// Per-session "what-if" recompute for documents dropped on the agent-ledger tile.
//
// POST application/json { documents: ExtractedDocument[] }
//   -> merges them with the canonical base documents,
//   -> re-runs the deterministic fusion pipeline (linkEvent -> validate -> analyze),
//   -> returns the updated AnalysisReport + the uploaded trade invoices.
//
// EPHEMERAL: this NEVER calls persistReport. The result is returned to the caller
// and swapped into the dashboard data-context for that session only — a public
// visitor's documents can never move the shared canonical close. Deterministic:
// no external model, no AWS, same input -> same output.

import { NextResponse } from "next/server";
import type { ExtractedDocument } from "@/lib/types";
import { recomputeReport } from "@/lib/recompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bounds the work per request — a single drop is a handful of documents.
const MAX_DOCS = 12;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body { documents: ExtractedDocument[] }." },
      { status: 400 },
    );
  }

  const documents = (body as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(documents) || documents.length === 0) {
    return NextResponse.json({ error: "No documents provided." }, { status: 400 });
  }
  if (documents.length > MAX_DOCS) {
    return NextResponse.json(
      { error: `Too many documents in one recompute (max ${MAX_DOCS}).` },
      { status: 400 },
    );
  }

  // Light shape guard — these come from our own /api/upload extractor, so we only
  // need to drop anything that is not a document object with a doc_type.
  const docs = documents.filter(
    (d): d is ExtractedDocument =>
      !!d && typeof d === "object" && typeof (d as { doc_type?: unknown }).doc_type === "string",
  );
  if (docs.length === 0) {
    return NextResponse.json({ error: "No valid documents to recompute." }, { status: 400 });
  }

  try {
    const { report, invoices } = await recomputeReport(docs);
    // PER-SESSION ONLY — never persistReport (would corrupt the shared demo close).
    return NextResponse.json({ report, invoices });
  } catch {
    return NextResponse.json({ error: "Recompute failed. Please try again." }, { status: 500 });
  }
}
