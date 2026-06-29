import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { extract, linkEvent, validate } from "../lib/pipeline";
import { runValidationScenario, tamperEvent } from "../lib/tamper";
import type { PayrollEvent } from "../lib/types";

function fixtureEvent(): PayrollEvent {
  return linkEvent(extract(samplePayroll));
}

describe("tamperEvent", () => {
  it("bank-misread corrupts bank_net_total ~15% high without mutating the original", () => {
    const event = fixtureEvent();
    const originalBank = event.bank_net_total;
    const tampered = tamperEvent(event, "bank-misread");

    assert.notEqual(tampered.bank_net_total, originalBank);
    assert.ok(tampered.bank_net_total > originalBank);
    // ~15% high.
    assert.ok(Math.abs(tampered.bank_net_total - originalBank * 1.15) < 0.01);
    // Original event is untouched (pure copy).
    assert.equal(event.bank_net_total, originalBank);
    // Only the one field changed: every other headline figure is preserved.
    assert.equal(tampered.employer_ika_total, event.employer_ika_total);
    assert.equal(tampered.gross_total, event.gross_total);
  });

  it("ika-misread corrupts employer_ika_total without touching bank_net_total", () => {
    const event = fixtureEvent();
    const tampered = tamperEvent(event, "ika-misread");

    assert.ok(tampered.employer_ika_total > event.employer_ika_total);
    assert.equal(tampered.bank_net_total, event.bank_net_total);
  });
});

describe("validate flips on a tampered event", () => {
  it("R1 fails when the bank total is mis-read", () => {
    const docs = extract(samplePayroll);
    const event = linkEvent(docs);

    const clean = validate(event, docs);
    const r1Clean = clean.find((r) => r.rule === "R1");
    assert.ok(r1Clean?.passed, "R1 should pass on the clean event");

    const tampered = validate(tamperEvent(event, "bank-misread"), docs);
    const r1Tampered = tampered.find((r) => r.rule === "R1");
    assert.equal(r1Tampered?.passed, false, "R1 must fail on the tampered event");
  });

  it("R2 fails when the employer-IKA total is mis-read vs the register", () => {
    const docs = extract(samplePayroll);
    const event = linkEvent(docs);

    const r2Clean = validate(event, docs).find((r) => r.rule === "R2");
    assert.ok(r2Clean?.passed, "R2 should pass on the clean event");

    const r2Tampered = validate(tamperEvent(event, "ika-misread"), docs).find((r) => r.rule === "R2");
    assert.equal(r2Tampered?.passed, false, "R2 must fail on the tampered event");
  });
});

describe("runValidationScenario", () => {
  it("returns an all-pass clean run and a failing tampered run", () => {
    const event = fixtureEvent();
    const scenario = runValidationScenario({ event }, "bank-misread");

    assert.ok(scenario.clean.every((r) => r.passed), "clean run should fully pass");
    assert.ok(scenario.tampered.some((r) => !r.passed), "tampered run should contain a failure");
    assert.equal(scenario.tamperedField, "bank_net_total");
    assert.equal(scenario.mode, "bank-misread");
    assert.ok(scenario.tamperNote.length > 0);
    // Same rule set in both runs (the contrast is the only difference).
    assert.deepEqual(
      scenario.clean.map((r) => r.rule),
      scenario.tampered.map((r) => r.rule),
    );
  });

  it("defaults to the bank-misread headline scenario", () => {
    const scenario = runValidationScenario({ event: fixtureEvent() });
    assert.equal(scenario.mode, "bank-misread");
    const failed = scenario.tampered.filter((r) => !r.passed);
    // Exactly one clean red row against otherwise-green: R1.
    assert.equal(failed.length, 1);
    assert.equal(failed[0].rule, "R1");
  });
});
