import assert from "node:assert/strict";
import { describe, it } from "node:test";

import samplePayroll from "../data/sample-payroll.json";
import { extract, linkEvent, validate } from "../lib/pipeline";

describe("payroll fusion pipeline", () => {
  it("fuses payslips into the headline employer-cost gap", () => {
    const docs = extract(samplePayroll);
    const event = linkEvent(docs);

    assert.equal(event.company, "ARCHON DEMO IKE");
    assert.equal(event.period, "2026-01");
    assert.equal(event.employee_count, 3);
    assert.equal(event.bank_net_total, 3994.74);
    assert.equal(event.gross_total, 5500);
    assert.equal(event.employer_ika_total, 1430);
    assert.equal(event.employer_cost_total, 6930);
    assert.equal(event.cost_gap_amount, 1430);
    assert.equal(event.cost_gap_pct, 35.8);
    assert.equal(event.hidden_total, 2935.26);
    assert.deepEqual(event.linked_docs, [
      "doc-bank-001",
      "doc-register-001",
      "doc-payslip-001",
      "doc-payslip-002",
      "doc-payslip-003",
    ]);
  });

  it("passes all cross-document checks for the canonical sample", () => {
    const docs = extract(samplePayroll);
    const event = linkEvent(docs);
    const results = validate(event, docs);

    assert.deepEqual(
      results.map((result) => [result.rule, result.passed]),
      [
        ["R1", true],
        ["R2", true],
        ["R3", true],
        ["R4", true],
      ]
    );
    assert.match(results.find((result) => result.rule === "R3")?.detail ?? "", /2026-01-31/);
  });

  it("fails the payment-date validation when the extracted event omits it", () => {
    const noDateFixture = JSON.parse(JSON.stringify(samplePayroll));
    delete noDateFixture.payment_date;

    const docs = extract(noDateFixture);
    const event = linkEvent(docs);
    const paymentDateRule = validate(event, docs).find((result) => result.rule === "R3");

    assert.equal(paymentDateRule?.passed, false);
    assert.equal(paymentDateRule?.detail, "no payment date found");
  });
});
