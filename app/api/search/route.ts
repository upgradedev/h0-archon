import { NextResponse } from "next/server";
import { osConfigured, search } from "@/lib/opensearch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/search?q=... — query the OpenSearch read-model. Empty queries and
// search outages degrade gracefully (the dashboard never breaks on search).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ query: "", total: 0, hits: [] });
  }
  if (!osConfigured()) {
    return NextResponse.json({
      query: q,
      total: 0,
      hits: [],
      error: "Search is not configured (OPENSEARCH_ENDPOINT missing).",
    });
  }

  try {
    const result = await search(q, { size: 40 });
    return NextResponse.json({ query: q, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    return NextResponse.json({ query: q, total: 0, hits: [], error: message }, { status: 502 });
  }
}
