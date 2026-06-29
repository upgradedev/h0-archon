// Verification-gating stress test.
//
// The Archon pipeline is "the AI proposes, the deterministic rules refuse to be
// fooled": AWS Bedrock vision reads the documents and PROPOSES numbers; the
// deterministic cross-document validator (lib/pipeline.ts::validate) then checks
// those proposed numbers against every source document and refuses to publish a
// figure the documents do not agree on.
//
// This module makes that safety net VISIBLE and demonstrable. It deliberately
// corrupts ONE field of an otherwise-correct PayrollEvent — simulating a
// plausible AI mis-read of a single document — and re-runs the SAME deterministic
// validator. A cross-document rule then flips to FAILED, proving the gate catches
// what a naive copy-the-number pipeline would publish silently.
//
// IMPORTANT: this is a SIMULATION. We are intentionally injecting a fault to
// exercise the guard rail; it is not a real extraction error. The module is pure,
// server-importable TypeScript (no "use client", no DB, no network). Client
// components must import ONLY the exported TYPES from here (type-only imports are
// erased at compile time, so the server-side pipeline never enters the client
// bundle).

import type { PayrollEvent, ValidationResult } from "./types";
import { extract, validate } from "./pipeline";
import { round2 } from "./format";

// The mis-read scenarios we can simulate. Each corrupts exactly one fused figure.
export type TamperMode = "bank-misread" | "ika-misread";

export interface ValidationScenario {
  // Clean run: the validator over the correctly-fused event (all rules pass).
  clean: ValidationResult[];
  // Tampered run: the validator over the event with one field corrupted.
  tampered: ValidationResult[];
  // Which event field was corrupted, and the human story of the mis-read.
  tamperedField: string;
  mode: TamperMode;
  tamperNote: string;
}

// Return a COPY of the event with exactly one field corrupted to simulate a
// plausible single-document AI mis-read. The original event is never mutated.
export function tamperEvent(event: PayrollEvent, mode: TamperMode): PayrollEvent {
  const copy: PayrollEvent = {
    ...event,
    // Defensive deep copies of the only nested members, so callers that read the
    // clean event after tampering see no mutation.
    employees: event.employees.map((e) => ({ ...e })),
    linked_docs: [...event.linked_docs],
  };

  switch (mode) {
    case "bank-misread":
      // Simulate the vision model reading the bank confirmation's net-transfer
      // total ~15% too high. R1 (bank net ≈ sum of payslip nets, ±2%) must fail.
      copy.bank_net_total = round2(event.bank_net_total * 1.15);
      return copy;
    case "ika-misread":
      // Simulate the model over-reading employer-IKA on the payslips by ~20%.
      // R2 (employer-IKA ratio vs the register) must fail.
      copy.employer_ika_total = round2(event.employer_ika_total * 1.2);
      return copy;
    default: {
      // Exhaustiveness guard: a new mode must be handled above.
      const _never: never = mode;
      return _never;
    }
  }
}

function tamperFieldFor(mode: TamperMode): string {
  return mode === "bank-misread" ? "bank_net_total" : "employer_ika_total";
}

function tamperNoteFor(mode: TamperMode): string {
  return mode === "bank-misread"
    ? "Bank confirmation net-transfer total mis-read ~15% too high"
    : "Employer social-security total mis-read ~20% too high vs the register";
}

// Build the full clean-vs-tampered scenario for a report. Both runs use the SAME
// extracted documents, so the ONLY difference between them is the single
// corrupted field — making the contrast a clean, honest A/B.
export function runValidationScenario(
  report: { event: PayrollEvent },
  mode: TamperMode = "bank-misread",
): ValidationScenario {
  // Deterministic, DB-free: re-derive the documents the validator cross-checks.
  const docs = extract();
  const clean = validate(report.event, docs);
  const tampered = validate(tamperEvent(report.event, mode), docs);
  return {
    clean,
    tampered,
    tamperedField: tamperFieldFor(mode),
    mode,
    tamperNote: tamperNoteFor(mode),
  };
}
