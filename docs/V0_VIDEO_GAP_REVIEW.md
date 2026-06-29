# v0 / H0 Video Gap Review

Source reviewed: https://youtu.be/NanSqsQMTBg

The video is the Azure Agents League Archon demo. For H0, only product and
demo-flow lessons are relevant; Azure-specific implementation details are not.

## Relevant Gaps Closed

- Document intake: added `/api/intake` and a dashboard intake panel that
  classifies bank, sales, purchase, payroll, and tax files by role.
- Eight-agent story: the visible run ledger is Extractor, Classifier, Event
  Linker, Validator, PnL, CashFlow, Employee, and Narrator.
- Live document upload: the dashboard's eight-agent run-ledger drop-zone (and
  `/api/upload`) accept a PDF and run AWS Bedrock vision extraction; `/extract`
  is the curated-sample read demo where field accuracy is scored against ground
  truth.
- Search: `/api/search` is documents-first — it returns individual documents with
  their number and date (then vendors and people) through an AWS OpenSearch CQRS
  read-model fed from DynamoDB Streams.
- Verification-gating: four cross-document rules (R1–R4) must pass before the
  fused payroll event is trusted, and each rule's status is shown on the
  dashboard.
- Source-backed claims: added deterministic citations to `/api/report`, the
  dashboard CFO brief, and `/api/evidence`.
- Conversational answer path: added `/api/ask` and an Ask Archon dashboard
  panel for finance questions such as true payroll cost versus bank statement.
- Demo evidence: live smoke now verifies business intelligence and citations,
  not only payroll totals.

## Intentionally Skipped

- Microsoft Teams surface: not relevant to the Vercel + AWS H0 challenge.
- Azure AI Foundry / Foundry IQ: not relevant to H0 sponsor stack.
- Azure Container Apps jobs: not relevant; H0 uses Vercel Functions.
- Third-party LLM narration: avoided so the public product stays sponsor-clean
  and deterministic.

## H0 Judge Story After Changes

Archon H0 now demonstrates the same business value as the video in the
competition-relevant stack: monthly SMB finance documents are accepted,
classified, linked, validated, reported, cited, persisted to AWS DynamoDB, and
queried through a Vercel-hosted dashboard and APIs.
