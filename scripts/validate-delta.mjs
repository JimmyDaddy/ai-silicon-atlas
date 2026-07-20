import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const delta = JSON.parse(await readFile(path.join(root, "src/data/generated/delta.json"), "utf8"));
const errors = [];

if (delta.schemaVersion !== 1) errors.push("delta schemaVersion must be 1");
if (!delta.generatedAt || Number.isNaN(Date.parse(delta.generatedAt))) errors.push("delta generatedAt must be an ISO timestamp");
for (const pathName of ["companies.filings", "companies.metrics", "companies.statuses", "companies.analysis", "intelligence.new", "intelligence.analysisRefreshed"]) {
  const value = pathName.split(".").reduce((current, key) => current?.[key], delta);
  if (!Array.isArray(value)) errors.push(`${pathName} must be an array`);
}
const calculated = (delta.companies?.filings?.length ?? 0)
  + (delta.companies?.metrics?.length ?? 0)
  + (delta.companies?.statuses?.length ?? 0)
  + (delta.companies?.analysis?.length ?? 0)
  + (delta.intelligence?.new?.length ?? 0)
  + (delta.intelligence?.analysisRefreshed?.length ?? 0);
if (delta.summary?.totalChanges !== calculated) errors.push("delta totalChanges does not match payload");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log(`Validated delta with ${calculated} change(s)`);
