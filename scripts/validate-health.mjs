import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const health = JSON.parse(await readFile(path.join(root, "src/data/generated/health.json"), "utf8"));
const errors = [];
const strict = process.argv.includes("--strict");

if (health.schemaVersion !== 1) errors.push("health schemaVersion must be 1");
if (!new Set(["healthy", "degraded", "critical"]).has(health.overall)) errors.push("health overall status is invalid");
if (!health.generatedAt || Number.isNaN(Date.parse(health.generatedAt))) errors.push("health generatedAt must be an ISO timestamp");
if (!Array.isArray(health.issues)) errors.push("health issues must be an array");
if (health.companies?.total < 1) errors.push("health company total must be positive");
if (health.intelligence?.total < 1) errors.push("health intelligence total must be positive");
if (health.providers?.secEdgar?.status === "ok" && !new Set(["direct", "Jina Reader relay"]).has(health.providers.secEdgar.transport)) {
  errors.push("health SEC provider transport is invalid");
}

const secFreshness = health.freshness?.secEdgar;
if (!secFreshness) {
  errors.push("health SEC freshness is missing");
} else {
  if (secFreshness.lastSuccessfulAt !== null && Number.isNaN(Date.parse(secFreshness.lastSuccessfulAt))) {
    errors.push("health SEC lastSuccessfulAt must be an ISO timestamp or null");
  }
  if (secFreshness.ageHours !== null && (!Number.isFinite(secFreshness.ageHours) || secFreshness.ageHours < 0)) {
    errors.push("health SEC ageHours must be a non-negative number or null");
  }
  if (!Number.isFinite(secFreshness.warningAfterHours) || secFreshness.warningAfterHours <= 0) {
    errors.push("health SEC warning threshold must be positive");
  }
  if (!Number.isFinite(secFreshness.criticalAfterHours) || secFreshness.criticalAfterHours <= secFreshness.warningAfterHours) {
    errors.push("health SEC critical threshold must be greater than warning threshold");
  }
}

for (const item of health.issues ?? []) {
  if (!new Set(["info", "warning", "critical"]).has(item.severity)) errors.push(`invalid issue severity: ${item.severity}`);
  if (!item.code || !item.title || !item.detail) errors.push("health issue is incomplete");
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

for (const item of health.issues ?? []) {
  const command = item.severity === "critical" ? "error" : item.severity === "warning" ? "warning" : "notice";
  console.log(`::${command} title=${item.title}::${item.detail}`);
}

if (strict && health.overall === "critical") {
  console.error("Operational data health is critical");
  process.exit(1);
}

console.log(`Validated ${health.overall} data health snapshot`);
