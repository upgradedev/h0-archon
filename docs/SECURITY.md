# Security — Archon H0 (Vercel + AWS)

This document is the security posture of the H0 Archon build: how it is scanned
in CI, how it maps to the **OWASP Top 10 (2021)** and the **OWASP Top 10 for LLM
Applications**, the threat model of the public live-upload surface, and the
residual risks we accept on purpose.

It is written to be **honest**, not aspirational. Where something is a deliberate
demo trade-off (the open auth posture) or a known limitation (declared
content-type validation only, advisory-not-enforcing scans), it says so.

---

## 1. Security scanning in CI

Four independent scanners run against this repo. Three are wired into the
standard CI; the live DAST scan is intentionally scheduled/manual because it
touches production.

| Scanner | Type | Where | Gate |
|---|---|---|---|
| **gitleaks** v8.18.4 | Secret scan (full git history) | `h0-archon-ci.yml` → `security` job | **Blocking** (`--exit-code 1`) |
| **npm audit** (`--omit=dev --audit-level=high`) | Dependency / SCA | `h0-archon-ci.yml` → `security` job | Advisory (`continue-on-error`) |
| **CodeQL** (`javascript-typescript`, `security-and-quality`) | SAST | `codeql.yml` | Reports to Security tab; PR annotations |
| **OWASP ZAP baseline** (`@v0.12.0`, `-a`) | DAST (passive) | `zap-baseline.yml` | **Advisory** (`fail_action: false`) |

- **CodeQL** runs on push to `master`/`main`, on every PR, and weekly. Build mode
  `none` (JS/TS extracts from source — no build step). Results land in the
  repository **Security → Code scanning** tab and as inline PR annotations.
- **ZAP baseline** runs on `workflow_dispatch` + weekly only — **never on push/PR**
  — because it scans the live production URL (`https://h0-archon.vercel.app`). It
  is a **passive** baseline (spider + observe; no active SQLi/XSS fuzzing of prod).
  Findings are published as a workflow artifact and a GitHub issue. Known-noise
  alerts are tuned in `.zap/rules.tsv`. It is advisory by design — a finding
  reports, it does not block.

---

## 2. OWASP Top 10 (2021) coverage

| # | Category | Status | Mitigation & evidence |
|---|---|---|---|
| **A01** | Broken Access Control | ✅ By design (open demo) + scaffolding present | The hosted demo is **intentionally open** so judges can explore without a login wall (documented in `middleware.ts` and the README). Enforcement is real and one edit away: populate `ENFORCE_PAGES` / `ENFORCE_APIS` in `middleware.ts` → unauthenticated enforced APIs return `401`, pages redirect to GitHub sign-in. The public upload path is **ephemeral**: an uploaded doc is extracted for display only and is **never** persisted into the canonical close (no `persistReport`), so a visitor cannot move the demo's numbers (`app/api/upload/route.ts`). |
| **A02** | Cryptographic Failures | ✅ Mitigated | All secrets are server-only (`AWS_*`, `BEDROCK_*`, `AUTH_GITHUB_*`, `AUTH_SECRET`). No secret is exposed via `NEXT_PUBLIC_*` or shipped in the client bundle. TLS is enforced end-to-end by Vercel; HSTS is set (see §4). The `AUTH_SECRET` build-only placeholder in `auth.ts` is reachable **only** when auth is disabled (no provider registered, nothing to sign). |
| **A03** | Injection | ✅ Mitigated | **DynamoDB**: all access uses AWS SDK command objects (`GetCommand`/`PutCommand`/`UpdateCommand`) with `ExpressionAttributeNames`/`Values` — no PartiQL, no string-built statements (`lib/db.ts`, `lib/store.ts`). **OpenSearch**: the user query is bound as a **value** inside a `multi_match` DSL object, never concatenated into a query string (`lib/search-model.ts::buildSearchQuery`). No SQL anywhere. |
| **A04** | Insecure Design | ✅ Mitigated | Upload surface designed defensively: content-type + size validated **before** any Bedrock spend; a **global atomic** daily rate limit (DynamoDB `ADD`) that concurrent requests cannot race past; ephemeral, no arbitrary file write (bytes go straight to Bedrock in-memory, nothing is written to disk or persisted). |
| **A05** | Security Misconfiguration | ✅ Fixed in this change | Baseline security headers are now set for every route in `next.config.mjs` `headers()`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a conservative `Permissions-Policy`, `Strict-Transport-Security`, and a **report-only** CSP (see §4). |
| **A06** | Vulnerable & Outdated Components | ✅ Mitigated | `npm audit` (high+) runs in CI; **CodeQL** adds SAST over first-party code; Dependabot/SCA via the GitHub Security tab. Dependencies are pinned via `package-lock.json` and installed with `npm ci`. |
| **A07** | Identification & Auth Failures | ✅ By design | NextAuth v5 GitHub OAuth with stateless signed JWT sessions (`auth.ts`). `trustHost` is correct behind the Vercel proxy. Sign-in is **offered, not required** on the demo (A01). No password store, no custom crypto. |
| **A08** | Software & Data Integrity Failures | ✅ Mitigated | CI installs with `npm ci` against a committed lockfile; gitleaks blocks secret introduction; CodeQL covers code integrity. The canonical financial numbers are computed by a **deterministic engine**, not mutated by external input. |
| **A09** | Security Logging & Monitoring | 🟡 Partial | Vercel provides request/function logs; the app persists audit activities (`persistActivity`) for intake/ask; CodeQL + ZAP findings are tracked. No dedicated SIEM/alerting (acceptable at demo scale — noted as residual). |
| **A10** | Server-Side Request Forgery (SSRF) | ✅ Mitigated | No user-controlled outbound URL anywhere. The upload accepts **file bytes**, never a URL to fetch. Bedrock, DynamoDB and OpenSearch endpoints are derived from server **env vars**, never from request input. |

---

## 3. OWASP Top 10 for LLM Applications

The live extraction surface (`/api/upload`, `/api/extract` → `lib/extraction/extract.ts`
→ AWS Bedrock Claude vision) is the LLM attack surface.

| # | Category | Status | Mitigation & evidence |
|---|---|---|---|
| **LLM01** | Prompt Injection | ✅ Mitigated (guardrail present) | The document being read is **untrusted input**. Both the `SYSTEM_PROMPT` and the `EXTRACTION_PROMPT` carry an explicit **SECURITY RULE**: any in-document text that looks like an instruction ("ignore previous instructions", "your new task is", …) is to be treated as **data to extract from, never a directive to follow** (`lib/extraction/extract.ts`). The source **filename is metadata only and is never sent to the model**. |
| **LLM02** | Insecure Output Handling | ✅ Mitigated | The model returns JSON only; it is parsed null-safely (`cleanJson` + `safeFloat`/`safeStr`, ADR-003) and rendered through React as **data**, never as HTML. The **only** `dangerouslySetInnerHTML` in the codebase is the static pre-paint theme bootstrap in `app/layout.tsx` — it contains **no** LLM output. Model output never reaches a DB statement, a shell, or `eval`. |
| **LLM04** | Model Denial of Service / Unbounded Consumption | ✅ Mitigated | 3 MB hard size ceiling, one file per request, and a **global 10-uploads/day** atomic cap bound Bedrock spend (`lib/upload.ts`). `maxTokens` is capped at 2048 per call. |
| **LLM06** | Sensitive Information Disclosure | ✅ Mitigated | Uploaded documents are **ephemeral** — extracted for display, never persisted, never indexed into the shared search read-model. Error responses are generic (no stack traces, no raw counts like "15/10" leaked). |
| **LLM08** | Excessive Agency | ✅ Mitigated | The LLM only **reads and structures** a document. It executes no tools, performs no writes, and computes **no** canonical financial figure — a deterministic engine does that. The model cannot trigger any state change. |

---

## 4. Security headers

Set for every route via `next.config.mjs` `headers()`:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Block MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking defense |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URLs cross-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disable unused powerful features |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `Content-Security-Policy-Report-Only` | conservative default-deny (see below) | Advisory CSP — **never blocks** |

**Why CSP is report-only, not enforcing.** Next.js injects its own un-nonced
hydration/bootstrap scripts, the pre-paint theme script in `app/layout.tsx` is
inline, and `@vercel/analytics` + `@vercel/speed-insights` inject scripts at
runtime. A strict enforcing `script-src` would break all of these. Shipping
`Content-Security-Policy-Report-Only` documents the intended default-deny posture
and (with a report endpoint) surfaces violations **without** risking a broken app.
Promoting to an enforcing CSP requires a nonce pipeline — tracked as future work.

---

## 5. Upload threat model (`/api/upload` + `lib/upload.ts`)

The live drag-and-drop extraction is the only place an anonymous visitor's bytes
reach a paid backend (AWS Bedrock). Controls, in request order:

1. **Type gate** — only `application/pdf`, `image/png`, `image/jpeg` accepted;
   anything else → `415`, **before** any Bedrock call.
2. **Size gate** — 3 MB hard ceiling → `413`. Bounds both request body and token cost.
3. **One file per request** — `MAX_FILES_PER_REQUEST = 1`; the endpoint never fans
   out multiple Bedrock calls per request.
4. **Global daily cap** — atomic DynamoDB `ADD` counter, 10/day, increment-then-check
   so concurrent requests **cannot race past** the cap. Generic `429` message (no
   raw count leak).
5. **No spend on misconfig** — if Bedrock isn't configured, returns `503` **without**
   burning a rate-limit slot.
6. **Ephemeral** — bytes are passed in-memory to Bedrock; **nothing is written to
   disk** and **nothing is persisted** into the canonical close. No path traversal
   is possible because the filename is treated as a metadata string only (it is
   never used to open/write a file, and never sent to the model).
7. **No SSRF** — input is bytes, not a URL.

### Residual risks (accepted)

- **Declared content-type only** — validation trusts the multipart `Content-Type`;
  there is no magic-byte sniff. Impact is low: the bytes only ever go to a vision
  model that tolerates mismatches, nothing is executed or stored, and size/rate
  caps bound any abuse. Adding a sniff is possible future hardening.
- **Open demo posture** — auth is intentionally not enforced (A01/A07). This is a
  product decision for a public judged demo, not an oversight; enforcement
  scaffolding is present and exercised.
- **Advisory scans** — `npm audit` and the ZAP baseline are advisory (report, not
  block) so a transient upstream advisory or a low-confidence passive alert cannot
  wedge the demo pipeline. gitleaks (secrets) and CodeQL remain authoritative.
- **Logging/monitoring** — request logs + audit activities only; no SIEM/alerting
  at demo scale.

---

## 6. Reporting

This is a public demo. For anything sensitive, open a private security advisory
on the GitHub repository rather than a public issue.
