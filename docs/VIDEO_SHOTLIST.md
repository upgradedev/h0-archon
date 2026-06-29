# H0 Demo Video — <3-Minute Shot List

**Target length:** 2:30–2:50 (hard cap 3:00 per Devpost rules).
**Goal:** hit all four judging criteria *and* the mandatory "show AWS database usage" requirement, in one clean take.
**Setup before recording:**
- Confirm production is redeployed with the latest `master` and `curl https://h0-archon.vercel.app/api/report` returns `db_mode: "aws-dynamodb"`.
- Open three browser tabs: (1) the live app, (2) `https://h0-archon.vercel.app/api/evidence`, (3) the **AWS Console → DynamoDB → Tables → your table → Explore table items**.
- Have the AWS console already signed in and on the items view (this is the mandatory proof — do not skip it).

| Time | Shot | What you say (script) | On screen |
|---|---|---|---|
| 0:00–0:20 | **Hook** | "Ask a small-business owner what payroll costs them and they read their bank statement. That number is short. The bank shows €3,995 transferred; the true employer cost is €6,930. €2,935 hidden, every month — 35.8% of the net, in employer social-security. Archon finds it." | Live app first viewport — payroll-truth finding visible |
| 0:20–0:40 | **The product** | "Archon is a monthly finance close for SMBs, built on the Vercel + AWS zero stack. One Next.js app on Vercel, AWS DynamoDB as the source of truth, AWS OpenSearch for instant search — no servers to manage." | Scroll the dashboard: P&L €47,200, EBITDA €30,698, sales 101.5%, closing cash €79,498 |
| 0:40–1:05 | **The agent flow** | "It runs an eight-agent close: Bedrock vision extracts every field, then classify, link the three payroll views into one event, validate, and the PnL, cash-flow, per-employee and narrator agents build the books." | Point at the eight-agent run ledger; then the document-intake panel |
| 1:05–1:30 | **The insight + validation** | "The truth is split across three documents — bank confirmation, payroll register, payslips. Fusing them is where the hidden cost appears. And four cross-document rules prove the fusion is trustworthy: bank net matches payslips, employer IKA is in the Greek statutory band, dates and headcount agree." | Show R1–R4 all passing; show the citations |
| 1:30–1:50 | **Ask Archon** | "You can ask it questions, and it answers with cited sources." | Type: *"What is the true payroll cost versus the bank statement?"* → show the cited answer |
| 1:50–2:20 | **★ AWS database proof (MANDATORY)** | "Everything persists to AWS DynamoDB. Here's the live API reporting db_mode aws-dynamodb — and here's that exact data in the AWS console: REPORT records for each close, ACTIVITY records for every intake and question, in a single-table design." | **Switch to AWS Console DynamoDB items view.** Show rows with `pk = REPORT` and `pk = ACTIVITY`. Expand one REPORT item so the revenue/EBITDA numbers match the app. Then flash the `/api/evidence` tab showing the same figures. |
| 2:20–2:40 | **Architecture + close** | "Next.js and Vercel Functions on the front, DynamoDB and OpenSearch on the back, a deterministic CFO engine in between — auditable, reproducible, and shippable in minutes. That's the zero stack." | Show the architecture diagram (README inline Mermaid; the older `docs/figures/h0-architecture.svg` is superseded); end on the live URL |

## Criteria coverage check (say or show each)
- **Technical implementation** — single-table DynamoDB, Vercel Functions, validation rules, CI (mention "full test pyramid and live smoke" at ~2:30 if time).
- **Design** — the dense, single-viewport CFO dashboard (0:20–0:40).
- **Impact** — the €2,935/month hidden-cost hook (0:00–0:20).
- **Originality** — three-document fusion + deterministic cited analysis (1:05–1:30).

## Hard requirements this video must satisfy (Devpost)
- [ ] Under 3 minutes.
- [ ] **Shows AWS database usage** — the DynamoDB console items view (1:50–2:20) is non-negotiable.
- [ ] Shows the functioning project (live app, not slides).
- [ ] Public on YouTube/Vimeo/Youku, link pasted into Devpost.

## Recording tips
- Record at 1080p, hide bookmarks bar, zoom the browser to ~110% so numbers are legible.
- If the live click-through feels slow, pre-warm the app once (the first request may cold-start a Vercel Function).
- Do the AWS console segment last in prep but keep it mid-video — judges look for it specifically.
