# LinkedIn post — Archon H0 (bonus content piece 2 of 3)

> Short, hook-first, business-audience. Paste to LinkedIn, attach the dashboard
> screenshot (`docs/figures/h0-dashboard-production.png`). ~320 words.

---

Your bank statement is lying to you about payroll. By 28%.

I built a small app this week for the H0 hackathon (Vercel + AWS) that proves it.

Here's the problem every small-business owner has and almost none can see: the three documents that describe a single payroll event each tell a *different* truth.

• The **bank confirmation** shows the net salaries that left your account — €5,957.
• The **payroll register** shows the real employer cost — €9,111.
• The gap — €3,154 every month, ~€38K a year — is employer social-security and withheld tax that never appears on the transfer line.

Most bookkeeping treats the bank number as "payroll cost." It's wrong by a quarter, and it quietly understates what the business actually owes.

**Archon** ingests the raw documents a business actually receives — bank statements, sales ledgers, purchase invoices, payroll — and fuses them into one auditable monthly close: P&L, cash runway, sales-vs-goal, supplier concentration, and the payroll-truth finding. Every number is backed by a source citation and four cross-document validation rules that either pass or tell you exactly which document disagrees.

The part I'm proud of: **AWS Bedrock vision reads the documents (96.7% field accuracy), but no black-box LLM *decides* your numbers.** The analysis runs on a deterministic finance engine, so it gives the same auditable answer every time — the only acceptable bar for a tool that touches money. AI reads; deterministic rules compute. Runs on AWS DynamoDB behind a Vercel app.

The "zero stack" lesson from the hackathon: when production collapses to *a front end and a database*, what separates a demo from a product isn't infrastructure — it's whether your numbers are **correct, cited, and reproducible.**

Live (no login): https://h0-archon.vercel.app
Code (MIT): https://github.com/upgradedev/h0-archon

#Vercel #AWS #DynamoDB #SMB #Fintech #Bookkeeping #BuildInPublic


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
