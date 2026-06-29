Archon: the AI reads, a deterministic engine does the math

Every month a small business closes its books, but the truth is scattered across documents that don't connect — a bank statement, a payroll register, payslips, invoices. The insight that started Archon: a payroll event's bank transfer (EUR 3,995) hides the true employer cost (EUR 6,930) — a EUR 2,935 social-security + tax wedge that's only visible once you correlate the register with the bank. Bank-only accounting can't see it, and the correlation problem is universal — only the local rules change.

Archon runs on the "zero stack": Next.js on Vercel, with the real work on AWS.

- Amazon DynamoDB — a single-table design (REPORT + ACTIVITY items) is the source of truth for every close. Known access patterns mean single-digit-ms reads, no connection pool, effectively free at demo scale.
- Amazon Bedrock (Claude Sonnet 4.6) — vision extraction at ~96.7% measured field accuracy: messy PDFs in, structured fields out.
- Amazon OpenSearch — a CQRS read-model fed from DynamoDB that powers documents-first search (find any invoice by number and date). It never computes a canonical number.

The guiding principle: the AI reads, a deterministic engine computes. No LLM ever touches a number — the same inputs always produce the same books, and every figure traces back to a source document. That is what makes the close auditable.

Drop a document on the dashboard and watch eight agents read it with Bedrock, link it, validate it across documents (four cross-checks), and recompute the close live — the affected tiles flash and update.

Try it live: https://h0-archon.vercel.app
Code (MIT): https://github.com/upgradedev/h0-archon

I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon
