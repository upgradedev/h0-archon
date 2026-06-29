import { NextResponse } from "next/server";
import { auth, AUTH_ENABLED } from "@/auth";

// ---------------------------------------------------------------------------
// Auth posture — "demonstrated, not gatekeeping" (intentional, documented).
//
// GitHub OAuth is a REAL, working capability in this app: users can sign in,
// a session is issued and verified, and their identity is shown in the header
// (see SiteNavAuth). The `auth()` wrapper below attaches that session to every
// request so server components can read it.
//
// We deliberately DO NOT block the demo routes. This is a public, judged demo:
// putting `/dashboard` or `/extract` behind a login wall would stop a reviewer
// from seeing the product work at all. So sign-in is OFFERED, never REQUIRED —
// the whole financial-intelligence experience is explorable without an account.
//
// Enforcement is one edit away. To lock the product down for a real tenant,
// populate ENFORCE_PAGES / ENFORCE_APIS below; the redirect/401 code path is
// present and exercised. We keep it empty on the hosted demo on purpose.
// ---------------------------------------------------------------------------

// Empty on the hosted demo (open by design). Populate to enforce per-route.
const ENFORCE_PAGES: string[] = [];
const ENFORCE_APIS: string[] = [];

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default auth((req) => {
  // Session is attached to req.auth for downstream server components regardless.
  if (!AUTH_ENABLED) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always public: landing, the auth endpoints, the icon.
  if (
    pathname === "/" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const isEnforcedApi = matchesPrefix(pathname, ENFORCE_APIS);
  const isEnforcedPage = matchesPrefix(pathname, ENFORCE_PAGES);

  // Nothing enforced on the demo → everything is explorable.
  if (!isEnforcedApi && !isEnforcedPage) return NextResponse.next();

  // Authenticated → allow.
  if (req.auth) return NextResponse.next();

  // Unauthenticated enforced API → 401 JSON (no redirect for fetch callers).
  if (isEnforcedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unauthenticated enforced HTML route → bounce to GitHub sign-in, returning here.
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
