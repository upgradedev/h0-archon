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
| PDFs rendered | 347 (full) · 48 (sample) |

**Edge cases (deliberate):**

| Tag | What it exercises | Effect on perfect-extraction ceiling |
|---|---|---|
| `standard` | full, consistent close | all rules pass |
| `missing_payslip` | register/bank reflect N, only N-1 payslips present | **R4 bug** (see §4) + R1 correctly fails |
| `non_standard_ika` | a legitimate non-standard employer-contribution rate | **R2 brittleness** (see §4) |
| `missing_bank` | no bank confirmation | exercises the pipeline's bank→payslip-net fallback |
| `bank_mismatch` | bank total off by ~6% (reconciliation break) | R1 correctly fails |
| `missing_register` | no register doc | proves the register is unused in fusion (§4) |
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
| Classification accuracy | **100.00%** (347/347) |
| Field accuracy | **100.00%** (2199/2199) |
| Fusion figure accuracy | **100.00%** (280/280) — **40/40 cases all-correct** |
| Validation-outcome accuracy | **98.75%** (158/160) |

The fusion math reproduces every key figure to the cent across the entire diverse
corpus → the aggregation generalizes (i.e. it is consistent with an independent
oracle across diverse inputs; not over-fit to the canonical sample). The two
validation gaps are intended: **one genuine logic bug (R4) plus one brittleness
flag (R2)** — see §4, not "two bugs."

(Sample, 6 cases: 100% / 100% / 100% figures, 91.67% validation — same two gaps.)

### Naive bookkeeping FLOOR (full, 39 cases with a bank doc)

The owner who treats the bank salary transfer as "the payroll cost":

| Quantity | Value |
|---|---|
| Total bank-only (the wrong number) | **EUR 502,769.52** |
| Total true employer cost | **EUR 816,800.31** |
| **Total understatement recovered** | **EUR 314,030.79** |
| Mean understatement, % of true cost | **38.10%** |
| Mean understatement, % over the bank figure | **61.70%** |
| Mean employer-IKA wedge, % over bank (the "~28%" headline) | **29.52%** |
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
| Classification | 100.00% | 89.63% |
| Field | 100.00% | 90.86% |
| Fusion figure | 100.00% | 27.50% |
| Validation-outcome | 98.75% | 67.50% |

Fusion accuracy collapses much faster than field accuracy — small per-field
extraction errors compound through the fusion sums. That is the signal a real
extractor will be optimised against.

---

## 4. Generalization bugs the diverse corpus exposed

These surface **under perfect extraction** — perfect inputs, wrong pipeline output
vs domain truth. They are real, not artefacts of bad OCR.

### BUG (airtight) — the payroll register is never read; R4 cannot do its job

**`linkEvent` and `validate` never read the `payroll_register` document at all** —
every fused total and all four rules are derived from the payslips + the bank
confirmation. `ExtractedDocument` has no register-headcount field. So a register
that disagrees with the payslips (on headcount or on any total it carries) is
**structurally undetectable**. This is the unassailable claim, provable by reading
`lib/pipeline.ts`.

R4 is the visible symptom. It is documented as "employee count consistent
(register vs payslips)", but it compares `docs.filter(payslip).length` against
`event.employee_count` — which is itself the count of payslips with a non-null
employee. Both sides come from the *same* payslip set, so R4 **can never fail on
the register-vs-payslip disagreement it claims to check** (it can only ever trip on
the unrelated edge of a payslip doc whose `employee` is null).

Demonstrated by `case-0002` (`missing_payslip`): register/bank reflect N
employees, only N-1 payslips are present.
- R1 (bank vs payslip-net) **correctly fails** — it does the real reconciliation.
- R4 **wrongly passes** (expected fail, got pass).

### BRITTLENESS (illustrative, secondary) — R2's hardcoded contribution band

R2 hardcodes the employer-IKA ratio to a single national rate (22.29% ±1pt). A
payroll with any legitimately different employer-contribution rate trips R2 even
under perfect extraction. Demonstrated by `case-0003` (`non_standard_ika`):
expected pass (internally consistent payroll), pipeline fails. We do **not** assert
a specific alternate statutory rate as fact — the point is only that the rule does
not generalize beyond one hardcoded band.

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
