/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish dependency; keep it external to the server bundle.
  // `mupdf` is a WASM module used by the /api/extract live PDF rasterizer —
  // keep it external so Next does not try to bundle the WASM payload.
  // `@opensearch-project/opensearch` is a node-only client (the AWS SigV4 signer
  // does a runtime `import('aws-sdk')` fallback that must NOT be bundled). Keep it
  // external so Next traces it at runtime instead of bundling it into the server.
  serverExternalPackages: ["pg", "mupdf", "@opensearch-project/opensearch"],
  // The /api/extract live path reads the committed sample PDFs from disk. Next's
  // output file tracing follows imports, not dynamic fs paths under eval/, so
  // include them explicitly. (The route degrades to a bundled cached example if
  // these are still missing, so this is best-effort, not load-bearing.)
  outputFileTracingIncludes: {
    "/api/extract": ["./eval/corpus/sample/**/*.pdf"],
  },
  // Baseline security headers, applied to every route. These are the low-risk,
  // framework-safe hardening headers (no enforcing CSP — see note below).
  //
  // NO enforcing Content-Security-Policy is set: Next.js injects its own
  // un-nonced hydration/bootstrap scripts, the pre-paint theme script in
  // app/layout.tsx is inline, and @vercel/analytics + @vercel/speed-insights
  // inject scripts at runtime. A strict `script-src` would break all of these.
  // We ship a Content-Security-Policy-Report-Only header instead: it NEVER
  // blocks, it only documents intent and (with a report endpoint) surfaces
  // violations. Promote to an enforcing CSP only once a nonce pipeline is in place.
  async headers() {
    const securityHeaders = [
      // Stop MIME-type sniffing (defends against content-type confusion).
      { key: "X-Content-Type-Options", value: "nosniff" },
      // No framing — clickjacking defense. Mirrored by frame-ancestors below.
      { key: "X-Frame-Options", value: "DENY" },
      // Don't leak full URLs/paths to third parties on cross-origin navigation.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Disable powerful browser features the app never uses.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
      // Force HTTPS for two years (Vercel already serves TLS-only).
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      // Advisory, report-only CSP. Does NOT block; allows the inline theme script
      // and Vercel's injected analytics scripts so nothing breaks while still
      // declaring a conservative default-deny posture.
      {
        key: "Content-Security-Policy-Report-Only",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.vercel-insights.com https://va.vercel-scripts.com",
        ].join("; "),
      },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
