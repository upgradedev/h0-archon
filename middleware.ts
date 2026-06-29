import { NextResponse } from "next/server";
import { auth, AUTH_ENABLED } from "@/auth";

// ---------------------------------------------------------------------------
// Auth gate.
//
// When AUTH_ENABLED is false (no GitHub OAuth env) this passes EVERYTHING
// through — the public-judge / CI / preview path stays fully open.
//
// When AUTH_ENABLED is true it requires a session for the product pages and the
// data/mutating APIs. The landing page, the NextAuth endpoints and static
// assets are always public. Unauthed HTML routes redirect to the GitHub
// sign-in; unauthed API routes get a 401 JSON.
// ---------------------------------------------------------------------------

const PROTECTED_PAGES = ["/dashboard", "/extract"];

const PROTECTED_APIS = [
  "/api/run",
  "/api/ask",
  "/api/intake",
  "/api/extract",
  "/api/report",
  "/api/history",
  "/api/evidence",
];

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default auth((req) => {
  if (!AUTH_ENABLED) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always public: landing, the auth endpoints themselves, and the icon.
  if (
    pathname === "/" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const isProtectedApi = matchesPrefix(pathname, PROTECTED_APIS);
  const isProtectedPage = matchesPrefix(pathname, PROTECTED_PAGES);

  // Anything not explicitly protected (e.g. other public assets) passes through.
  if (!isProtectedApi && !isProtectedPage) return NextResponse.next();

  // Authenticated → allow.
  if (req.auth) return NextResponse.next();

  // Unauthenticated API → 401 JSON (no redirect for fetch callers).
  if (isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unauthenticated HTML route → bounce to the GitHub sign-in, returning here.
  const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Run on everything except Next internals and common static files. The
  // negative lookahead keeps the middleware off the static asset pipeline so
  // images/fonts/icon are never gated.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
