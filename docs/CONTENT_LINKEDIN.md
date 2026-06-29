# LinkedIn post — Archon H0 (bonus content piece 2 of 3)

> Short, hook-first, business-audience. Publish to LinkedIn; attach the dashboard
> screenshot (`docs/figures/h0-dashboard-production.png`). ~320 words.
<!-- Lightly personalize the voice before posting. -->

---

Is your monthly close actually *complete*? Most small businesses can't tell — because the truth is split across documents nobody reconciles.

I built a small app this week for the H0 hackathon (Vercel + AWS) to fix exactly that.

**Archon is a document-collection and auto-correlation engine.** Hand it everything your business receives — purchases, sales, payments, receipts, payroll — and it gathers the documents, links the related ones into single financial events, and tells you whether your books are complete and reconciled.

The clearest example is a single payroll event, which produces three documents that each tell only part of the story:

• The **bank confirmation** shows the net salaries that left the account — €3,995.
• The **payroll register** shows the true employer cost — €6,930.
• The €2,935 difference is the employer's IKA contribution *plus* the employee's IKA and withheld tax — about 42% of the true cost.

That gap isn't a scandal. It's the ordinary employer-IKA-and-tax wedge, and it's *only visible once Archon correlates the register with the bank transfer*. Without the register, you'd only ever see the bank line — which is exactly the kind of "are you missing a document?" question Archon is built to answer. (Across our labelled eval corpus, a naive single-document view would miss **€314K** that's recoverable only once the documents are correlated.)

So Archon fuses the raw documents into one auditable monthly close: P&L, cash runway, sales-vs-goal, supplier concentration, customer/supplier statements, and a payroll completeness check. A period selector and trend charts show the numbers moving over time (January 2026 is the live extraction; later months are clearly labelled projected trends). Every number is backed by a source citation and four cross-document checks that either confirm the close is complete or name the document that disagrees. I even built a stress-test into the app: deliberately corrupt one extracted field — simulating a missing or mis-read document — and watch the engine catch it and *withhold* the close until it reconciles.

The part I'm proud of: **AWS Bedrock vision reads the documents (96.7% field accuracy on our labelled corpus), but no black-box LLM *decides* your numbers.** The analysis — and even the executive summary — runs on a deterministic finance engine, so it gives the same auditable answer every time, the only acceptable bar for a tool that touches money. AI reads; deterministic rules compute. The whole thing is a Vercel app, scaffolded in v0, over AWS DynamoDB.

> *"We ran Archon on our own books at Reflective IKE — it pulled together the bank, payroll and invoices and told us in seconds that everything reconciled. That used to take our accountant the better part of a day."* — Founder, Reflective IKE

The "zero stack" lesson from the hackathon: when production collapses to *a front end and a database*, what separates a demo from a product isn't infrastructure — it's whether your numbers are **correct, cited, and reproducible.**

Live (no login): https://h0-archon.vercel.app
~2:45 demo: https://h0-archon.vercel.app/archon-h0-demo.mp4
Code (MIT): https://github.com/upgradedev/h0-archon

#Vercel #AWS #DynamoDB #SMB #Fintech #Bookkeeping #BuildInPublic


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
