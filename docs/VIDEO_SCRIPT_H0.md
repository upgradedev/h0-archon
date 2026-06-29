# Archon H0 — Demo Video Script (< 3 minutes)

**Target runtime:** 2:40–2:55 (hard cap 3:00 per Devpost rules).
**One clean screen-recorded take. No slides — the live app is the proof.**
**Prizes this script targets:** Best Technical Implementation · Most Impactful · B2B-track 1st.

---

## Pre-flight (do before you hit record)

1. Confirm production is on the final `master` and live:
   `curl https://h0-archon.vercel.app/api/report` → must show `db_mode: "aws-dynamodb"`.
   (If it shows `embedded-demo`, the Vercel env var `DYNAMODB_TABLE` is missing — fix before recording.)
2. Open five tabs, in this order:
   - **T1** — live app `https://h0-archon.vercel.app` (already warmed with one click so no cold start on camera).
   - **T2** — `https://h0-archon.vercel.app/api/evidence`.
   - **T3** — **AWS Console → DynamoDB → Tables → your table → Explore table items**, signed in, on the items view. *This is the mandatory proof — do not skip it.*
   - **T4** — a terminal already showing the live extraction output, or `eval/LIVE_EXTRACTION.md` open. (The 96.7% Bedrock run.)
   - **T5** — `docs/figures/h0-architecture.svg`.
3. Record 1080p, browser zoom ~110%, bookmarks bar hidden, so every number is legible.

---

## Shot list

| Time | Segment | What you SAY (narration) | What's ON SCREEN |
|---|---|---|---|
| **0:00–0:20** | **Hook (€314k / 28%)** | "Ask a small-business owner what payroll costs them, and they read their bank statement. That number is wrong. The bank shows €5,957 transferred — the true employer cost is €9,111. That's €3,154 hidden, every single month, and about 28% understatement just from employer social security. Across our test books it adds up to €314,000 of cost that bank-only bookkeeping never sees. Archon finds it." | T1 — live app first viewport; the payroll-truth card (€5,957 → €9,111, €3,154 hidden) visible |
| **0:20–0:42** | **The product, the stack** | "Archon is a monthly finance close for small businesses, built entirely on the H0 zero stack: one Next.js app on Vercel, one AWS DynamoDB table. No servers to run. It's a full close — not just payroll." | T1 — scroll the dashboard: Revenue €96,800, EBITDA €20,889, sales goal attainment 96.8%, closing cash €58,789, purchase concentration (fresh produce 42.7% of COGS) |
| **0:42–1:05** | **The agent flow** | "It runs a seven-step close — intake the documents, classify them, extract the fields, link the three payroll views into one event, validate, persist, and analyze. The design principle is one line: the AI reads the documents, deterministic rules compute the books. So extraction handles messy real inputs, and every reported number stays auditable." | T1 — click **Run Finance Close**; point at the seven-step run ledger and the document-intake panel |
| **1:05–1:35** | **★ Live AI extraction — 96.7% (Bedrock)** | "This isn't a mock. The reader is AWS Bedrock vision — Claude Sonnet 4.6 — running on real rendered PDFs. We measured it against a labelled corpus: 96.7% field-level accuracy, 100% document classification. And classification is content-only — the filename is never sent to the model. AWS reads; our rules compute." | T4 — **primary: a pre-captured terminal showing the harness run** (`npx tsx tests/live-extract-accuracy.ts eval/corpus/sample 5`) with the result table: 15/15 classification, 58/60 fields = 96.7%, model `eu.anthropic.claude-sonnet-4-6`, region eu-west-1. *Fallback if no terminal capture: `eval/LIVE_EXTRACTION.md`.* (Don't run it live on camera — cold-start/cost risk; capture the output beforehand.) |
| **1:35–1:55** | **Fusion + validation** | "The truth is split across three documents — bank confirmation, payroll register, and payslips. Fusing them is where the hidden cost appears. Four cross-document rules prove the fusion is trustworthy: bank net matches the payslips, the employer-IKA ratio cross-checks against the register, dates agree, and the register headcount matches the payslips on file." | T1 — show R1–R4 passing; show the source-backed citations |
| **1:55–2:10** | **Ask Archon** | "You can interrogate the close, and it answers with cited sources." | T1 — type *"What is the true payroll cost versus the bank statement?"* → show the cited answer panel |
| **2:10–2:40** | **★ AWS database proof (MANDATORY)** | "Everything persists to AWS DynamoDB. Here's the live API reporting db_mode aws-dynamodb — and here is that exact data in the AWS console. This is a deliberate single-table design: REPORT items for each finance close, ACTIVITY items for every intake and question, partitioned by record type." | T3 — **AWS Console DynamoDB items view.** Show rows with `pk = REPORT` and `pk = ACTIVITY` together. Expand one `REPORT` item so revenue / EBITDA match the app. Then flash **T2** `/api/evidence` showing the same `db_mode=aws-dynamodb`, `records=REPORT+ACTIVITY`, and matching `revenue` / `ebitda` / `payroll_gap` |
| **2:40–2:55** | **Architecture + close** | "Next.js and Vercel Functions on the front, DynamoDB on the back, a deterministic CFO engine in between — measured at 96.7% extraction, fully auditable, shippable in minutes. That's the zero stack. Try it live." | T5 — architecture figure for two seconds; end full-screen on **https://h0-archon.vercel.app** |

---

## Criteria coverage (every prize is hit on camera)

- **Best Technical Implementation** — live Bedrock extraction with a *measured* 96.7% number (1:05), single-table DynamoDB shown in console (2:10), Vercel Functions + validation rules + the AI-reads/rules-compute split (0:42).
- **Most Impactful** — the €314k / €3,154-a-month hidden-cost hook (0:00), quantified, not asserted.
- **B2B-track 1st** — a real SMB workflow (monthly finance close, P&L, cash, sales, purchases, payroll controls) with cited, auditable output (0:20, 1:35).
- **Design** — the dense single-viewport CFO dashboard (0:20).

## Hard requirements this video must satisfy (Devpost)

- [ ] Under 3 minutes.
- [ ] **Shows AWS database usage** — the DynamoDB console items view (2:10–2:40) is non-negotiable; name "DynamoDB" out loud.
- [ ] Shows the functioning project live (not slides) — including the live 96.7% Bedrock extraction.
- [ ] Honest: every number on screen is a measured, reproducible value (see `eval/LIVE_EXTRACTION.md`, `eval/BASELINE.md`).
- [ ] Public on YouTube/Vimeo, link pasted into Devpost.

## Honesty guardrails (do not overclaim)

- The "28%" is the **employer-IKA wedge** specifically (`employer_ika / bank_net`, 27.9% on the sample). The **full** understatement over the bank figure is larger — about **61.7%** / **€314k** across the corpus — because it also includes withheld employee IKA and income tax. Say "about 28% from employer social security" for the wedge and "€314k across the books" for the total; never merge them into one inflated percentage.
- Say "measured 96.7%" not "99%+". The two misses were payslip fields on one document — fine to mention if asked.
- Do not claim v0 provenance on camera unless a real v0 artifact is attached (see `docs/V0_USAGE.md`).

---

## What YOU (the user) still need to do

1. **Pre-check live mode:** run `curl https://h0-archon.vercel.app/api/report` and confirm `db_mode: "aws-dynamodb"`. If it says `embedded-demo`, set `DYNAMODB_TABLE` in the Vercel project env and redeploy before recording.
2. **Capture the extraction terminal:** run `BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6 BEDROCK_REGION=eu-west-1 npx tsx tests/live-extract-accuracy.ts eval/corpus/sample 5` once, off-camera, and screenshot/record the output for the 1:05–1:35 shot.
3. **Open the AWS console** to DynamoDB → Tables → your table → Explore table items (signed in, items showing both `pk=REPORT` and `pk=ACTIVITY`) for the 2:10–2:40 shot.
4. **Record** the video per this script — one clean take, 1080p, under 3:00.
5. **Upload** to YouTube (or Vimeo), set visibility to **Public** (not Unlisted-only if the rules require public), and copy the link.
6. **Submit on Devpost:** paste the body of `docs/TEXT_DESCRIPTION_H0.md`, the live URL (https://h0-archon.vercel.app), the repo URL (https://github.com/upgradedev/h0-archon), and the video link. Add the DynamoDB console screenshot to the gallery.
7. **v0 evidence:** attach a real v0 artifact if you have one, or omit any v0 claim (see `docs/V0_USAGE.md`). Do not fabricate one.
8. **Final gate:** confirm GitHub Actions is green on the submitted commit and `npm run smoke:live` passes.
