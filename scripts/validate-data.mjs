import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const identifiers = JSON.parse(await readFile(path.join(root, "src/data/company-identifiers.json"), "utf8"));
const snapshot = JSON.parse(await readFile(path.join(root, "src/data/generated/company-updates.json"), "utf8"));
const errors = [];
const warnings = [];
const validStatuses = new Set(["ok", "manual", "unconfigured", "error"]);

if (snapshot.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (!snapshot.generatedAt || Number.isNaN(Date.parse(snapshot.generatedAt))) {
  errors.push("generatedAt must be an ISO timestamp");
} else {
  const ageDays = (Date.now() - Date.parse(snapshot.generatedAt)) / 86_400_000;
  if (ageDays > 14) errors.push(`snapshot is stale (${ageDays.toFixed(1)} days old)`);
}

const secSource = snapshot.sources?.secEdgar;
if (secSource?.status === "ok") {
  if (!secSource.completedAt || Number.isNaN(Date.parse(secSource.completedAt))) {
    errors.push("SEC source completedAt must be an ISO timestamp");
  }
  if (!new Set(["direct", "Jina Reader relay"]).has(secSource.transport)) {
    errors.push("SEC source transport must identify direct or relayed delivery");
  }
}

for (const slug of Object.keys(identifiers)) {
  const company = snapshot.companies?.[slug];
  if (!company) {
    errors.push(`missing generated entry for ${slug}`);
    continue;
  }
  if (!validStatuses.has(company.status)) errors.push(`${slug} has invalid status ${company.status}`);
  if (!company.checkedAt) warnings.push(`${slug} has no checkedAt timestamp`);

  if (company.latestFiling?.url) {
    try {
      new URL(company.latestFiling.url);
    } catch {
      errors.push(`${slug} has an invalid latestFiling URL`);
    }
  }

  if (!Array.isArray(company.recentFilings)) errors.push(`${slug}.recentFilings must be an array`);
  if (company.latestFiling && company.recentFilings?.[0]?.accessionNumber !== company.latestFiling.accessionNumber) {
    errors.push(`${slug}.latestFiling does not match recentFilings[0]`);
  }

  for (const [metricName, metric] of Object.entries(company.metrics ?? {})) {
    if (typeof metric.value !== "number") errors.push(`${slug}.${metricName} is not numeric`);
    if (!metric.periodEnd) errors.push(`${slug}.${metricName} has no periodEnd`);
    const history = company.metricHistory?.[metricName];
    if (!Array.isArray(history) || !history.length) errors.push(`${slug}.${metricName} has no history`);
    if (history?.[0]?.periodEnd !== metric.periodEnd) warnings.push(`${slug}.${metricName} latest history period differs from snapshot`);
  }

  if (company.provider === "SEC EDGAR" && company.status === "ok" && Object.keys(company.metrics ?? {}).length) {
    if (!company.metricsCheckedAt || Number.isNaN(Date.parse(company.metricsCheckedAt))) {
      errors.push(`${slug}.metricsCheckedAt must identify the Company Facts refresh time`);
    }
  }

  for (const [metricName, periods] of Object.entries(company.metricHistory ?? {})) {
    if (!Array.isArray(periods) || periods.length > 8) errors.push(`${slug}.${metricName} has invalid history length`);
    for (let index = 0; index < periods.length; index += 1) {
      if (typeof periods[index].value !== "number") errors.push(`${slug}.${metricName}[${index}] is not numeric`);
      if (index > 0 && periods[index - 1].periodEnd < periods[index].periodEnd) {
        errors.push(`${slug}.${metricName} history is not newest-first`);
      }
    }
  }
}

for (const slug of Object.keys(snapshot.companies ?? {})) {
  if (!identifiers[slug]) warnings.push(`generated snapshot contains unknown company ${slug}`);
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${Object.keys(identifiers).length} company data entries`);
