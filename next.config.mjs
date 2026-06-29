/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish dependency; keep it external to the server bundle.
  // `mupdf` is a WASM module used by the /api/extract live PDF rasterizer —
  // keep it external so Next does not try to bundle the WASM payload.
  serverExternalPackages: ["pg", "mupdf"],
  // The /api/extract live path reads the committed sample PDFs from disk. Next's
  // output file tracing follows imports, not dynamic fs paths under eval/, so
  // include them explicitly. (The route degrades to a bundled cached example if
  // these are still missing, so this is best-effort, not load-bearing.)
  outputFileTracingIncludes: {
    "/api/extract": ["./eval/corpus/sample/**/*.pdf"],
  },
};

export default nextConfig;
