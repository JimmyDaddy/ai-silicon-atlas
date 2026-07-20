import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contexts = JSON.parse(await readFile(path.join(root, "src/data/analysis-context.json"), "utf8"));
const snapshot = JSON.parse(await readFile(path.join(root, "src/data/generated/company-analysis.json"), "utf8"));
const errors = [];
const statuses = new Set(["ok", "pending", "unavailable", "error"]);

if (snapshot.schemaVersion !== 1) errors.push("analysis schemaVersion must be 1");
if (snapshot.promptVersion !== "company-synthesis-v2") errors.push("unexpected analysis promptVersion");

for (const slug of Object.keys(contexts)) {
  const analysis = snapshot.companies?.[slug];
  if (!analysis) {
    errors.push(`missing analysis entry for ${slug}`);
    continue;
  }
  if (!statuses.has(analysis.status)) errors.push(`${slug} has invalid analysis status`);
  if (!analysis.inputHash) errors.push(`${slug} has no inputHash`);

  if (analysis.status === "ok") {
    if (!analysis.summary || !analysis.generatedAt || !analysis.model) errors.push(`${slug} has incomplete AI metadata`);
    for (const field of ["whatChanged", "operatingSignals", "valueChainImpact", "uncertainties", "questionsToWatch"]) {
      if (!Array.isArray(analysis[field])) errors.push(`${slug}.${field} must be an array`);
    }
    const knownEvidence = new Set((analysis.evidenceSources ?? []).map((source) => source.id));
    for (const field of ["whatChanged", "operatingSignals", "valueChainImpact", "uncertainties"]) {
      for (const point of analysis[field] ?? []) {
        if (typeof point.text !== "string") errors.push(`${slug}.${field} contains invalid text`);
        if ((point.evidence ?? []).some((id) => !knownEvidence.has(id))) {
          errors.push(`${slug}.${field} references unknown evidence`);
        }
      }
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${Object.keys(contexts).length} company analysis entries`);
