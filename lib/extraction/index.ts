// Public surface of the real (AWS Bedrock) multimodal extraction layer.
//
// This module is purely ADDITIVE. The existing deterministic pipeline
// (lib/pipeline.ts `extract()` over the bundled synthetic dataset) is untouched
// and remains the default for the live app and CI — nothing here is imported by
// the running app unless explicitly opted in.
//
// Opt-in usage (e.g. behind a feature flag or in a worker):
//
//   import { extractCaseDir } from "@/lib/extraction";
//   import { linkEvent, validate } from "@/lib/pipeline";
//   const docs  = await extractCaseDir(caseDir);     // real Bedrock extraction
//   const event = linkEvent(docs);                   // unchanged fusion
//   const checks = validate(event, docs);            // unchanged validation
//
// The deterministic path stays exactly:
//   import { extract } from "@/lib/pipeline";        // bundled sample data
//
// Both produce the same ExtractedDocument[] shape, so linkEvent/validate/analyze
// are identical downstream.

export {
  extractDocument,
  extractCaseDir,
  rasterizePdf,
  cleanJson,
  safeFloat,
  EXTRACTION_PROMPT,
  SYSTEM_PROMPT,
  type ExtractInput,
  type ExtractionOutcome,
  type ExtractDeps,
} from "./extract";

export {
  converse,
  buildConverseInput,
  createBedrockClient,
  DEFAULT_MODEL_ID,
  DEFAULT_REGION,
  type ConverseClientLike,
  type ConverseRequest,
  type ConverseResult,
  type ContentPart,
} from "./bedrock";
