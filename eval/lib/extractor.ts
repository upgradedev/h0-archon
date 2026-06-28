// The extraction SLOT.
//
// An `Extractor` turns a case directory (rendered PDFs in `docs/`) into the
// canonical `ExtractedDocument[]` the rest of the product pipeline consumes.
// THIS is exactly where a real OCR/vision-LLM extraction layer plugs in to be
// measured — the harness scores whatever extractor it is given against the
// ground-truth labels.
//
//   real layer:  (caseDir) => read docs/*.pdf -> vision LLM -> ExtractedDocument[]
//
// Until that exists we ship three reference extractors:
//   - perfectExtractor  : reads the ground-truth labels (the CEILING).
//   - degradedExtractor : perturbs the labels (proves the metrics are sensitive).
//   - visionExtractorStub: the unimplemented slot (throws), kept as the contract.

import fs from "node:fs";
import path from "node:path";
import { extract } from "../../lib/pipeline";
import type { ExtractedDocument } from "../../lib/types";

export interface Extractor {
  name: string;
  run: (caseDir: string) => ExtractedDocument[];
}

function readGt(caseDir: string): any {
  return JSON.parse(fs.readFileSync(path.join(caseDir, "ground_truth.json"), "utf-8"));
}

// CEILING: feed the true structured labels through the real product extract().
export const perfectExtractor: Extractor = {
  name: "perfect-extraction (ceiling)",
  run: (caseDir) => extract(readGt(caseDir).extracted),
};

export interface DegradeOpts {
  // fraction of numeric fields to corrupt with relative noise
  numericNoiseRate?: number;
  numericNoiseMagnitude?: number; // e.g. 0.05 = up to +/-5%
  // fraction of payslip docs to drop a field from (-> null)
  dropFieldRate?: number;
  // fraction of docs whose doc_type is misclassified
  misclassifyRate?: number;
  seed?: number;
}

// A deterministic, label-only "weak extractor" used to demonstrate that the
// metrics discriminate. It never reads a PDF — it just degrades the truth.
export function degradedExtractor(opts: DegradeOpts = {}): Extractor {
  const {
    numericNoiseRate = 0.2,
    numericNoiseMagnitude = 0.06,
    dropFieldRate = 0.1,
    misclassifyRate = 0.2,
    seed = 42,
  } = opts;

  return {
    name: `degraded-extraction (noise=${numericNoiseMagnitude}, drop=${dropFieldRate}, misclass=${misclassifyRate})`,
    run: (caseDir) => {
      let s = seed + caseDir.length;
      const rand = () => {
        // xorshift-ish deterministic PRNG
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 100000) / 100000;
      };
      const docs = extract(readGt(caseDir).extracted);
      const types: ExtractedDocument["doc_type"][] = [
        "bank_confirmation",
        "payroll_register",
        "payslip",
      ];
      const noise = (v: number | null | undefined) => {
        if (v == null) return v;
        if (rand() < numericNoiseRate) {
          const f = 1 + (rand() * 2 - 1) * numericNoiseMagnitude;
          return Math.round(v * f * 100) / 100;
        }
        return v;
      };
      return docs.map((d) => {
        const out: ExtractedDocument = { ...d };
        if (rand() < misclassifyRate) {
          out.doc_type = types[Math.floor(rand() * types.length)];
        }
        out.bank_net_total = noise(out.bank_net_total);
        out.gross_total = noise(out.gross_total);
        out.employer_ika_total = noise(out.employer_ika_total);
        if (out.employee) {
          const e = { ...out.employee };
          e.gross = noise(e.gross) as number;
          e.employer_ika = noise(e.employer_ika) as number;
          e.net = noise(e.net) as number;
          if (rand() < dropFieldRate) (e as any).employer_ika = null;
          out.employee = e;
        }
        return out;
      });
    },
  };
}

// The real slot — intentionally unimplemented. Wire a vision/OCR model here and
// the existing harness scores it with no other changes.
export const visionExtractorStub: Extractor = {
  name: "vision-extraction (UNIMPLEMENTED slot)",
  run: () => {
    throw new Error(
      "visionExtractorStub: not implemented. Read caseDir/docs/*.pdf with a " +
        "vision/OCR model and return ExtractedDocument[]. The harness will then " +
        "score classification, field, and fusion accuracy automatically."
    );
  },
};
