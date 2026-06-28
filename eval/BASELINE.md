# Archon Evaluation Keystone — Baselines

This is the measurement frame that turns "better / SOTA" into a number. Data +
scorer + honest baselines come first; a real extraction layer is scored against
*this* harness, not the other way round.

Reproduce:

```bash
npm run eval:gen           # generate sample (6) + full (40) corpus (needs: pip install reportlab)
npm run eval eval/corpus/full     # ceiling + naive floor + sensitivity
npm test                          # includes eval/tests/metrics.test.ts
```

The small `eval/corpus/sample/` (6 cases) is committed and on its own reproduces
every finding below; the 40-case `eval/corpus/full/` is gitignored (regenerate
deterministically with `--seed 7`).

---

## 1. Corpus design

For every document we emit **both** a rendered PDF (what a real OCR/vision
extractor must read) **and** the ground-truth structured labels (free, because we
generate them). Each case also carries the independently-computed `expected_event`
(spec oracle for fusion), `expected_validations` (domain truth for R1–R4), and the
naive bank-only figure.

| Dimension | Range in the full (40-case) corpus |
|---|---|
| Companies | 12 generic synthetic Greek SMB names across sectors |
| Periods | 2025-01 … 2026-12 (random) |
| Employees / case | 1 – 12 |
| Salary band | EUR 850 – 4,200 gross (per employee, varied) |
| Documents / case | 3 – 13 (bank + register + N payslips) |
| PDFs rendered | 346 (full) · 48 (sample) |

**Edge cases (deliberate):**

| Tag | What it exercises | Effect on perfect-extraction ceiling |
|---|---|---|
| `standard` | full, consistent close | all rules pass |
| `missing_payslip` | register/bank reflect N, only N-1 payslips present | R4 now correctly fails (register N ≠ payslips N-1) + R1 correctly fails |
| `non_standard_ika` | a legitimate non-standard employer-contribution rate | R2 now correctly passes (register-inferred rate) |
| `missing_bank` | no bank confirmation | exercises the pipeline's bank→payslip-net fallback |
| `bank_mismatch` | bank total off by ~6% (reconciliation break) | R1 correctly fails |
| `missing_register` | no register doc | R4/R2 fall back to pass (no register to cross-check) |
| `register_mismatch` | all payslips present, register declares a different headcount | **isolated R4 proof**: R1 passes, R4 fails on register-vs-payslip disagreement |
| `multi_page` | payslip rendered across 2 pages | substrate for a real extractor |
| `noisy_values` | Greek decimal commas, thousand dots, `EUR` symbol | substrate for a real extractor |
| `alt_layout` | reordered register rows | substrate for a real extractor |
| `missing_fields` | payslip PDF omits the employer-IKA line | substrate for a real extractor |

The last four change only the *rendered* artifact, not the labels, so they don't
move the ceiling — they exist to challenge a future real extractor.

---

## 2. Metric definitions

| Metric | Definition | Match rule |
|---|---|---|
| **Classification accuracy** | extracted `doc_type` vs truth, matched by source filename | exact |
| **Field accuracy** | every extracted number/date vs the labelled value | numbers: within 1 cent OR ≤0.5% relative; dates: exact |
| **Fusion figure accuracy** | the 7 key figures the product reports (`employer_cost_total`, `hidden_total`, `cost_gap_pct`, `gross_total`, `employer_ika_total`, `bank_net_total`, `employee_count`) vs the independently-computed truth | same numeric rule; `employee_count` exact |
| **Validation-outcome accuracy** | pipeline R1–R4 pass/fail vs **domain truth** | exact boolean |
| **Naive floor** | bank-only "payroll cost" vs true `employer_cost_total` | EUR + % understatement |

Key-figure "expected" (the true totals) is kept **separate** from validation
"expected" (is this payroll actually consistent?) — conflating them would hide the
bugs in §4.

---

## 3. Measured baselines

### Perfect-extraction CEILING (full, 40 cases)

Perfect labels → the **real** `linkEvent` / `validate` product code.

| Metric | Result |
|---|---|
| Classification accuracy | **100.00%** |
| Field accuracy | **100.00%** |
| Fusion figure accuracy | **100.00%** (280/280) — **40/40 cases all-correct** |
| Validation-outcome accuracy | **100.00%** (160/160) |

The fusion math reproduces every key figure to the cent across the entire diverse
corpus → the aggregation generalizes (i.e. it is consistent with an independent
oracle across diverse inputs; not over-fit to the canonical sample).

> **GAP #2 fix (validation correctness).** The two validation gaps the diverse
> corpus originally exposed — a genuine logic bug (R4) and a brittleness flag
> (R2), measured at **98.75% (158/160)** ceiling / **91.67%** sample — are now
> **fixed**: validation-outcome is **100%** on both corpora, with **zero**
> generalization divergences. See §4 for the before/after.

(Sample, 6 cases: 100% / 100% / 100% figures, **100%** validation.)

### Naive bookkeeping FLOOR (full, 39 cases with a bank doc)

The owner who treats the bank salary transfer as "the payroll cost":

| Quantity | Value |
|---|---|
| Total bank-only (the wrong number) | **EUR 499,439.43** |
| Total true employer cost | **EUR 813,865.35** |
| **Total understatement recovered** | **EUR 314,425.92** |
| Mean understatement, % of true cost | **38.19%** |
| Mean understatement, % over the bank figure | **62.01%** |
| Mean employer-IKA wedge, % over bank (the "~28%" headline) | **29.58%** |
| Max understatement, % over bank | **67.03%** |

**Two different numbers, reported separately on purpose.** The project's headline
"~28%" is the *employer-IKA wedge only* (`cost_gap_pct = employer_ika / bank_net`).
The *full* understatement (`hidden_total / bank_net`) also includes withheld
employee IKA and income tax, so it is roughly double — ~62% over the bank figure
on average. The canonical sample's `cost_gap_pct` of 27.88 (a pinned product test)
is the wedge, not the full gap; the floor numbers do not contradict it.

(The floor spans all 39 cases that have a bank confirmation, including the two
deliberately-broken bank cases — `bank_mismatch` ~+6% and `missing_payslip`'s
N-vs-(N-1) mix. Their effect on the aggregate is small, but the floor is best read
as "understatement over the documents present," not a clean per-employee rate.)

### Sensitivity check (the metrics actually move)

A deliberately weak label-only extractor (numeric noise, dropped fields,
misclassification) scores well below the ceiling — proof the harness discriminates:

| Metric | Ceiling | Degraded |
|---|---|---|
| Classification | 100.00% | 89.02% |
| Field | 100.00% | 91.01% |
| Fusion figure | 100.00% | 27.50% |
| Validation-outcome | 100.00% | 60.00% |

Fusion accuracy collapses much faster than field accuracy — small per-field
extraction errors compound through the fusion sums. That is the signal a real
extractor will be optimised against.

---

## 4. Generalization bugs the diverse corpus exposed — and the GAP #2 fix

These surfaced **under perfect extraction** — perfect inputs, wrong pipeline output
vs domain truth. They were real, not artefacts of bad OCR. Both are now **fixed**;
the before/after is recorded here so the fix is auditable against the harness.

### BUG (airtight, FIXED) — the payroll register is now read; R4 does its job

**Before:** `linkEvent` and `validate` never read the `payroll_register` document
at all — every fused total and all four rules were derived from the payslips + the
bank confirmation, and `ExtractedDocument` had no register-headcount field. A
register that disagreed with the payslips (on headcount) was **structurally
undetectable**. R4 was the visible symptom: documented as "employee count
consistent (register vs payslips)", it compared `docs.filter(payslip).length`
against `event.employee_count` — both sides came from the *same* payslip set, so it
**could never fail** on the register-vs-payslip disagreement it claimed to check.

**Fix:** `ExtractedDocument` and `PayrollEvent` gained register fields
(`register_employee_count` + register totals); `linkEvent` surfaces them from the
register doc; R4 now compares the **register-reported headcount** against the
payslips on file and FAILS when they disagree. The fused totals stay
payslip-derived (granular truth), so no reported figure moves — the fix is
additive.

- `case-0002` (`missing_payslip`): register reports 7, 6 payslips present →
  **R4 now correctly fails** (`register=7 vs payslips=6`); R1 also fails. (Before:
  R4 wrongly passed.)
- `case-0011` (`register_mismatch`, new edge): all payslips present, bank
  reconciles, register declares headcount N+1 → **R1 passes, R4 fails** — an
  *isolated* proof of the cross-check, unconfounded by an R1 break.

### BRITTLENESS (FIXED) — R2 no longer hardcodes one contribution band

**Before:** R2 hardcoded the employer-IKA ratio to a single national rate
(22.29% ±1pt). Any legitimately different employer-contribution rate tripped R2
even under perfect extraction (`case-0003`, `non_standard_ika`: expected pass,
pipeline failed).

**Fix:** when a register is present R2 infers the expected rate **from the register
itself** and cross-checks the payslip-derived rate against it (a genuine
consistency check at any legitimate rate); when no register is present it falls
back to a reference band and merely **flags** (never hard-fails) anything outside
it. No specific alternate statutory rate is asserted as fact. `case-0003` now
**correctly passes** via the register cross-check (`24.06% vs register 24.06%`).

---

## 5. Where the real-extraction layer plugs in

The entire harness is parameterised on one interface (`eval/lib/extractor.ts`):

```ts
export interface Extractor {
  name: string;
  run: (caseDir: string) => ExtractedDocument[]; // read docs/*.pdf -> structured
}
```

- `perfectExtractor` — reads the labels (the ceiling above).
- `degradedExtractor` — perturbs the labels (the sensitivity check).
- `visionExtractorStub` — **the open slot**: read `caseDir/docs/*.pdf` with a
  vision/OCR model and return `ExtractedDocument[]`.

Drop a real extractor in and `npm run eval` scores its classification, field, and
end-to-end fusion accuracy against the same ground truth, with **no other change**.
Every subsequent SOTA gap — #1 real extraction, #2 generalization (fixing R4/R2) —
is measured here.
