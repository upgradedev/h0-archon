// Evaluation keystone — the harness that turns "better/SOTA" into a number.
//
//   ceiling : perfect-extraction -> real pipeline -> figures vs ground truth.
//             Proves the fusion math generalizes across the diverse corpus.
//   floor   : naive bank-only bookkeeping error -> the EUR/% Archon recovers.
//   slot    : swap any Extractor (e.g. a real vision model) and this same code
//             scores classification + field + fusion accuracy.
//
// Run:  tsx eval/evaluate.ts [corpusDir]   (default eval/corpus/sample)

import fs from "node:fs";
import path from "node:path";
import { loadCorpus, type CorpusCase } from "./lib/corpus";
import {
  degradedExtractor,
  perfectExtractor,
  type Extractor,
} from "./lib/extractor";
import {
  naiveFloor,
  scoreClassification,
  scoreFields,
  scoreFusion,
} from "./lib/metrics";

interface Aggregate {
  extractor: string;
  cases: number;
  classification: { correct: number; total: number; accuracy: number };
  fields: { correct: number; total: number; accuracy: number };
  fusionFigures: { correct: number; total: number; accuracy: number };
  fusionValidations: { correct: number; total: number; accuracy: number };
  // cases where inputs are correct yet a rule disagrees with domain truth
  generalizationDivergences: Array<{
    case_id: string;
    edge_cases: string[];
    rule: string;
    expected: boolean;
    got: boolean;
  }>;
  perfectFigureCases: number; // cases with all key figures correct
}

function runExtractor(extractor: Extractor, cases: CorpusCase[]): Aggregate {
  const agg: Aggregate = {
    extractor: extractor.name,
    cases: cases.length,
    classification: { correct: 0, total: 0, accuracy: 0 },
    fields: { correct: 0, total: 0, accuracy: 0 },
    fusionFigures: { correct: 0, total: 0, accuracy: 0 },
    fusionValidations: { correct: 0, total: 0, accuracy: 0 },
    generalizationDivergences: [],
    perfectFigureCases: 0,
  };

  for (const { gt, caseDir } of cases) {
    const docs = extractor.run(caseDir);
    const cls = scoreClassification(docs, gt);
    const fld = scoreFields(docs, gt);
    const fus = scoreFusion(docs, gt);

    agg.classification.correct += cls.correct;
    agg.classification.total += cls.total;
    agg.fields.correct += fld.correct;
    agg.fields.total += fld.total;
    agg.fusionFigures.correct += fus.figuresCorrect;
    agg.fusionFigures.total += fus.figuresTotal;
    agg.fusionValidations.correct += fus.validationsCorrect;
    agg.fusionValidations.total += fus.validationsTotal;
    if (fus.figuresCorrect === fus.figuresTotal) agg.perfectFigureCases += 1;

    for (const rule of fus.validationDivergences) {
      agg.generalizationDivergences.push({
        case_id: gt.case_id,
        edge_cases: gt.edge_cases,
        rule,
        expected: fus.validations[rule].expected,
        got: fus.validations[rule].actual,
      });
    }
  }

  const pct = (c: number, t: number) => (t ? c / t : 1);
  agg.classification.accuracy = pct(agg.classification.correct, agg.classification.total);
  agg.fields.accuracy = pct(agg.fields.correct, agg.fields.total);
  agg.fusionFigures.accuracy = pct(agg.fusionFigures.correct, agg.fusionFigures.total);
  agg.fusionValidations.accuracy = pct(agg.fusionValidations.correct, agg.fusionValidations.total);
  return agg;
}

function pctStr(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

function printAggregate(a: Aggregate) {
  console.log(`\n  [${a.extractor}]  (${a.cases} cases)`);
  console.log(
    `    classification accuracy : ${pctStr(a.classification.accuracy)}  (${a.classification.correct}/${a.classification.total})`
  );
  console.log(
    `    field accuracy          : ${pctStr(a.fields.accuracy)}  (${a.fields.correct}/${a.fields.total})`
  );
  console.log(
    `    fusion figure accuracy  : ${pctStr(a.fusionFigures.accuracy)}  (${a.fusionFigures.correct}/${a.fusionFigures.total})  [${a.perfectFigureCases}/${a.cases} cases all-correct]`
  );
  console.log(
    `    validation-outcome acc. : ${pctStr(a.fusionValidations.accuracy)}  (${a.fusionValidations.correct}/${a.fusionValidations.total})`
  );
}

function main() {
  const corpusDir = process.argv[2] || "eval/corpus/sample";
  const cases = loadCorpus(corpusDir);

  console.log("=".repeat(72));
  console.log(`ARCHON EVALUATION KEYSTONE  —  corpus: ${corpusDir}  (${cases.length} cases)`);
  console.log("=".repeat(72));

  // ---- CEILING ---------------------------------------------------------
  const ceiling = runExtractor(perfectExtractor, cases);
  console.log("\nCEILING — perfect extraction through the real pipeline:");
  printAggregate(ceiling);

  console.log("\n  Generalization divergences (perfect inputs, rule != domain truth):");
  if (ceiling.generalizationDivergences.length === 0) {
    console.log("    none — every rule matched domain truth across the corpus.");
  } else {
    for (const d of ceiling.generalizationDivergences) {
      console.log(
        `    ${d.case_id}  ${d.rule}  expected=${d.expected} got=${d.got}  edge=${d.edge_cases.join(",") || "-"}`
      );
    }
    // categorize
    const byRule: Record<string, number> = {};
    for (const d of ceiling.generalizationDivergences) byRule[d.rule] = (byRule[d.rule] ?? 0) + 1;
    console.log(`    by rule: ${JSON.stringify(byRule)}`);
  }

  // ---- FLOOR -----------------------------------------------------------
  const floor = naiveFloor(cases.map((c) => c.gt));
  console.log("\nNAIVE FLOOR — bank-only bookkeeping vs true employer cost:");
  console.log(`    cases with a bank confirmation        : ${floor.cases}`);
  console.log(`    total bank-only (the wrong number)    : EUR ${floor.total_bank_only.toLocaleString()}`);
  console.log(`    total true employer cost              : EUR ${floor.total_true_cost.toLocaleString()}`);
  console.log(`    total understatement recovered        : EUR ${floor.total_understatement.toLocaleString()}`);
  console.log(`    mean understatement (% of true cost)  : ${floor.mean_understatement_pct_of_true.toFixed(2)}%`);
  console.log(`    mean understatement (% over bank)     : ${floor.mean_understatement_pct_of_bank.toFixed(2)}%`);
  console.log(`    mean employer-IKA wedge (% over bank) : ${floor.mean_employer_ika_wedge_pct_of_bank.toFixed(2)}%`);
  console.log(`    max understatement (% over bank)      : ${floor.max_understatement_pct_of_bank.toFixed(2)}%`);

  // ---- SENSITIVITY CHECK ----------------------------------------------
  const degraded = runExtractor(degradedExtractor(), cases);
  console.log("\nSENSITIVITY — a deliberately weak extractor (proves the metrics move):");
  printAggregate(degraded);

  // ---- write machine-readable results ---------------------------------
  const out = {
    corpus: corpusDir,
    cases: cases.length,
    ceiling,
    naive_floor: floor,
    degraded,
    generated_at: new Date().toISOString(),
  };
  const outPath = path.resolve("eval/RESULTS.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log("=".repeat(72));
}

main();
