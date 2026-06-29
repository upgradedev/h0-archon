# Archon H0 — Docs Index

The front door to `docs/`. Everything here supports the Vercel + AWS H0
submission. Canonical demo: **ARCHON DEMO IKE**, January 2026 — bank €3,994.74 /
true employer cost €6,930 / employer social-security €1,430 / revenue €47,200 /
EBITDA €30,697.55 / 3 employees / eight-agent pipeline.

Markers: ✅ current · 🕘 dated snapshot (kept for the historical record, not the
source of truth).

## Submission

| Doc | What it is | |
|---|---|---|
| [`../SUBMISSION.md`](../SUBMISSION.md) | Top-level submission package (repo root) | ✅ |
| [`TEXT_DESCRIPTION_H0.md`](TEXT_DESCRIPTION_H0.md) | Devpost text description of the project | ✅ |
| [`V0_USAGE.md`](V0_USAGE.md) | v0 provenance checklist (what we can honestly claim) | ✅ |
| [`V0_PROMPT.md`](V0_PROMPT.md) | The v0 prompt pack used to generate the UI | ✅ |

## Architecture

| Doc | What it is | |
|---|---|---|
| [`ARCHITECTURE_AND_EVIDENCE.md`](ARCHITECTURE_AND_EVIDENCE.md) | Runtime architecture + judge-evidence invariants | ✅ |
| [`ARCHITECTURE_SCALE.md`](ARCHITECTURE_SCALE.md) | Data-tier scale path: DynamoDB → CQRS + OpenSearch | ✅ |
| [`ARCHITECTURE.mmd`](ARCHITECTURE.mmd) | Mermaid source for the pipeline diagram | ✅ |
| [`figures/`](figures/) | Architecture figure + dashboard screenshots (SVG superseded by the README inline Mermaid) | ✅ |

## Evidence / Proof

| Doc | What it is | |
|---|---|---|
| [`DYNAMODB_PROOF.md`](DYNAMODB_PROOF.md) | Single-table DynamoDB design + public runtime proof | ✅ |
| [`AWS_PROOF.md`](AWS_PROOF.md) | Captured `describe-table` / `scan` evidence of the live table | 🕘 |
| [`AWS_PROOF_CAPTURE.md`](AWS_PROOF_CAPTURE.md) | Raw AWS CLI capture commands + output | 🕘 |
| [`LIVE_EVIDENCE_2026-06-28.md`](LIVE_EVIDENCE_2026-06-28.md) | Live-run snapshot (pre-ARCHON-DEMO data) | 🕘 |
| [`demo/`](demo/) | Sample finance documents used by the pipeline | ✅ |

## Security

| Doc | What it is | |
|---|---|---|
| [`SECURITY.md`](SECURITY.md) | OWASP Top 10 + LLM Top 10 posture, headers, threat model | ✅ |

## Content

| Doc | What it is | |
|---|---|---|
| [`BLOG.md`](BLOG.md) | Long-form engineering blog post (Medium) — publish-ready | ✅ |
| [`CONTENT_DEVLOG.md`](CONTENT_DEVLOG.md) | Build devlog (dev.to, with front matter) — publish-ready | ✅ |
| [`CONTENT_LINKEDIN.md`](CONTENT_LINKEDIN.md) | LinkedIn announcement — publish-ready | ✅ |

## Video

| Doc | What it is | |
|---|---|---|
| [`VIDEO_SHOTLIST.md`](VIDEO_SHOTLIST.md) | Sub-3-minute shot list | ✅ |
| [`VIDEO_SCRIPT_H0.md`](VIDEO_SCRIPT_H0.md) | Historical shot-guide — superseded by `narration.txt` (canonical spoken script) | 🕘 |
| [`V0_VIDEO_GAP_REVIEW.md`](V0_VIDEO_GAP_REVIEW.md) | Gap review against the prior demo video | ✅ |
| [`RECORDING_RUNSHEET.md`](RECORDING_RUNSHEET.md) | Recording runsheet (owned by the recording step) | ✅ |
| [`narration.txt`](narration.txt) | Narration text (owned by the recording step) | ✅ |
</content>
