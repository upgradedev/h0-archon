import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCorpus } from "../lib/corpus";
import { degradedExtractor, perfectExtractor } from "../lib/extractor";
import {
  naiveFloor,
  numMatch,
  scoreClassification,
  scoreFields,
  scoreFusion,
} from "../lib/metrics";

const SAMPLE = "eval/corpus/sample";

describe("metric primitives", () => {
  it("numMatch tolerates a cent and a 0.5% relative drift", () => {
    assert.equal(numMatch(100.0, 100.009), true); // < 1 cent abs
    assert.equal(numMatch(10000, 10040), true); // 0.4% rel
    assert.equal(numMatch(10000, 10080), false); // 0.8% rel
    assert.equal(numMatch(0, 0.005), true);
    assert.equal(numMatch(100, NaN), false);
  });
});

describe("perfect-extraction ceiling on the committed sample", () => {
  const cases = loadCorpus(SAMPLE);

  it("classifies and extracts every field perfectly", () => {
    for (const { caseDir, gt } of cases) {
      const docs = perfectExtractor.run(caseDir);
      const cls = scoreClassification(docs, gt);
      const fld = scoreFields(docs, gt);
      assert.equal(cls.accuracy, 1, `${gt.case_id} classification`);
      assert.equal(fld.accuracy, 1, `${gt.case_id} fields`);
    }
  });

  it("reproduces every key figure to the cent across the whole corpus", () => {
    for (const { caseDir, gt } of cases) {
      const docs = perfectExtractor.run(caseDir);
      const fus = scoreFusion(docs, gt);
      assert.equal(
        fus.figuresCorrect,
        fus.figuresTotal,
        `${gt.case_id} figures: ${JSON.stringify(fus.figures)}`
      );
    }
  });
});

describe("the diverse corpus exposes the validation generalization bugs", () => {
  const cases = loadCorpus(SAMPLE);
  const byId = new Map(cases.map((c) => [c.caseId, c]));

  it("R4 is tautological: a missing payslip passes R4 when domain truth fails it", () => {
    const c = byId.get("case-0002")!; // missing_payslip
    assert.ok(c.gt.edge_cases.includes("missing_payslip"));
    const fus = scoreFusion(perfectExtractor.run(c.caseDir), c.gt);
    // domain truth says R4 should fail; the pipeline wrongly passes it
    assert.equal(fus.validations.R4.expected, false);
    assert.equal(fus.validations.R4.actual, true);
    assert.ok(fus.validationDivergences.includes("R4"));
    // R1 (which does compare bank vs payslips) correctly catches the break
    assert.equal(fus.validations.R1.expected, false);
    assert.equal(fus.validations.R1.actual, false);
  });

  it("R2 is brittle: a legitimate non-standard contribution rate trips the hardcoded band", () => {
    const c = byId.get("case-0003")!; // non_standard_ika
    const fus = scoreFusion(perfectExtractor.run(c.caseDir), c.gt);
    assert.equal(fus.validations.R2.expected, true);
    assert.equal(fus.validations.R2.actual, false);
    assert.ok(fus.validationDivergences.includes("R2"));
  });

  it("standard cases pass all four rules", () => {
    const c = byId.get("case-0001")!;
    const fus = scoreFusion(perfectExtractor.run(c.caseDir), c.gt);
    assert.equal(fus.validationDivergences.length, 0);
    assert.equal(fus.validationsCorrect, 4);
  });
});

describe("naive floor quantifies the bank-only understatement", () => {
  const cases = loadCorpus(SAMPLE);

  it("recovers a material, positive understatement on cases with a bank doc", () => {
    const floor = naiveFloor(cases.map((c) => c.gt));
    assert.ok(floor.cases >= 1);
    assert.ok(floor.total_understatement > 0);
    assert.ok(floor.total_true_cost > floor.total_bank_only);
    // the employer-IKA wedge (~28%) is strictly smaller than the full gap
    assert.ok(floor.mean_employer_ika_wedge_pct_of_bank < floor.mean_understatement_pct_of_bank);
  });
});

describe("metrics are sensitive (a weak extractor scores below the ceiling)", () => {
  const cases = loadCorpus(SAMPLE);

  it("degraded extraction drops field and fusion accuracy", () => {
    const weak = degradedExtractor({ seed: 7 });
    let figCorrect = 0;
    let figTotal = 0;
    let fldCorrect = 0;
    let fldTotal = 0;
    for (const { caseDir, gt } of cases) {
      const docs = weak.run(caseDir);
      const fus = scoreFusion(docs, gt);
      const fld = scoreFields(docs, gt);
      figCorrect += fus.figuresCorrect;
      figTotal += fus.figuresTotal;
      fldCorrect += fld.correct;
      fldTotal += fld.total;
    }
    assert.ok(fldCorrect < fldTotal, "field accuracy should drop below 100%");
    assert.ok(figCorrect < figTotal, "fusion accuracy should drop below 100%");
  });
});
