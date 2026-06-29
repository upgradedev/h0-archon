# Demo documents (fictional · anonymized · safe for public use)

These PDFs belong to **ARCHON DEMO IKE**, a fully **fictional** Greek company.
Every name, amount, IBAN, VAT/AFM number and date is **synthetic** — there is no
real person, business or bank account behind any of them. They exist only to
power the public read demo on `/extract`, the dashboard upload drop-zone, and the
upload integration tests, so they are safe to commit, redistribute and screenshot.

| File | Document type |
|---|---|
| `bank_confirmation_202601.pdf` | Bank mass-payment confirmation (net salary cash out) |
| `payroll_register_202601.pdf` | Payroll register (gross + employer social-security) |
| `payslip_emp001_202601.pdf` | Single-employee payslip |
| `aws_invoice_202601.pdf` | Purchase invoice (cloud cost) |
| `anthropic_invoice_202601.pdf` | Purchase invoice (LLM API cost) |
| `google_statement_202601.pdf` | Purchase invoice / statement |
| `attiki_odos_invoice_202601.pdf` | Purchase invoice (tolls) |

## Public-demo upload cap

> **Public demo: live uploads are globally capped at 10/day to bound AWS Bedrock
> spend; the curated samples are always available.**

The **dashboard's eight-agent run-ledger drop-zone** runs the **same live AWS
Bedrock vision extraction** as the curated-sample path on `/extract`, but on
whatever document you drop — the agents animate and the affected tiles flash with
the recomputed (per-session) numbers. To keep that public and free of abuse, the
upload endpoint enforces a **global limit of 10 live extractions per calendar
day** (a single atomic DynamoDB counter, TTL'd to expire automatically). When the
cap is reached the endpoint returns HTTP 429 and the UI points you back to the
always-on curated samples.

Uploaded documents are **ephemeral**: they are extracted for display only and are
never written into the shared canonical monthly close.
