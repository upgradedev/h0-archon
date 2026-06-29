# LinkedIn post — Archon H0 (bonus content piece 2 of 3)

> Short, hook-first, business-audience. Publish to LinkedIn; attach the dashboard
> screenshot (`docs/figures/h0-dashboard-production.png`). ~320 words.
<!-- Lightly personalize the voice before posting. -->

---

Your bank statement is lying to you about payroll. The employer's own social-security contribution adds ~28% on top of the transfer — and it appears on no document at all.

I built a small app this week for the H0 hackathon (Vercel + AWS) that proves it.

Here's the problem every small-business owner has and almost none can see: the three documents that describe a single payroll event each tell a *different* truth.

• The **bank confirmation** shows the net salaries that left your account — €5,957.
• The **payroll register** shows the real employer cost — €9,111.
• The full gap — €3,154 every month, ~€38K a year — is the employer's IKA contribution *plus* the employee's IKA and withheld tax that never appear on the transfer line. That's about 53% over the bank figure.

Most bookkeeping treats the bank number as "payroll cost." It's wrong by half, and it quietly understates what the business actually owes. Across the full document corpus, that adds up to **€314K** of understated cost.

**Archon** ingests the raw documents a business actually receives — bank statements, sales ledgers, purchase invoices, payroll — and fuses them into one auditable monthly close: P&L, cash runway, sales-vs-goal, supplier concentration, customer/supplier statements, and the payroll-truth finding. A month-by-month period selector and trend charts show the numbers moving over time (May 2026 is the live extraction; earlier months are clearly labelled demo data). Every number is backed by a source citation and four cross-document validation rules that either pass or tell you exactly which document disagrees.

The part I'm proud of: **AWS Bedrock vision reads the documents (96.7% field accuracy), but no black-box LLM *decides* your numbers.** The analysis — and even the executive summary — runs on a deterministic finance engine, so it gives the same auditable answer every time, the only acceptable bar for a tool that touches money. AI reads; deterministic rules compute. The whole thing is a Vercel app, scaffolded in v0, over AWS DynamoDB.

The "zero stack" lesson from the hackathon: when production collapses to *a front end and a database*, what separates a demo from a product isn't infrastructure — it's whether your numbers are **correct, cited, and reproducible.**

Live (no login): https://h0-archon.vercel.app
2:56 demo: https://h0-archon.vercel.app/archon-h0-demo.mp4
Code (MIT): https://github.com/upgradedev/h0-archon

#Vercel #AWS #DynamoDB #SMB #Fintech #Bookkeeping #BuildInPublic


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
