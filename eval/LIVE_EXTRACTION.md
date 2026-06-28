# Live extraction accuracy — real Bedrock vision (measured)

Gap #1 (real multimodal extraction) measured against the eval harness ground truth.
This is the honest "does real extraction work" number — not the perfect-extraction
ceiling (which is 100% by construction).

## Result — Claude Sonnet 4.6 (AWS Bedrock vision)

- Model: `eu.anthropic.claude-sonnet-4-6` (cross-region inference profile), region `eu-west-1`
- Corpus: `eval/corpus/sample` (rendered PDFs → rasterized → vision extraction)
- Sample: 15 documents, stratified ≤5 per doc-type
- Date: 2026-06-28

| Doc type | Classification | Field accuracy |
|---|---|---|
| bank_confirmation | 5/5 (100%) | 5/5 (100%) |
| payroll_register | 5/5 (100%) | 25/25 (100%) |
| payslip | 5/5 (100%) | 28/30 (93.3%) |
| **Overall** | **15/15 (100%)** | **58/60 (96.7%)** |

- Cost: ≈ $0.17 (in 34,515 tok / out 4,412 tok @ $3/$15 per 1M)
- The two misses were payslip fields on one document; bank + register were perfect.

## Interpretation
- Real vision extraction recovers **96.7%** of fields vs the perfect-extraction
  ceiling of 100% — i.e. the document-fusion product works on genuinely messy
  rendered inputs, not just pre-structured JSON.
- Classification is **100%** and is content-only (filenames are never sent to the
  model — verified by the extraction unit tests).
- Reproduce: `BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6 BEDROCK_REGION=eu-west-1 npx tsx tests/live-extract-accuracy.ts eval/corpus/sample 5`

## Provider notes
- Requires the one-time Anthropic use-case form on the AWS account (submitted for
  Claude Sonnet 4.6). Works via standard SIGV4 creds in **eu-west-1**; us-east-1 /
  us-west-2 returned ResourceNotFound (entitlement is region-scoped to eu-west-1).
- For production (Vercel Functions), set `BEDROCK_MODEL_ID`, `BEDROCK_REGION=eu-west-1`,
  and AWS creds with `bedrock:InvokeModel` on the project.
