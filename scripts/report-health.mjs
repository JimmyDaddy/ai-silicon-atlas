import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const health = JSON.parse(await readFile(path.join(root, "src/data/generated/health.json"), "utf8"));
const icon = { healthy: "✅", degraded: "⚠️", critical: "🚨" }[health.overall];
const lines = [
  `## ${icon} Data health: ${health.overall}`,
  "",
  `- Companies: ${health.companies.fresh} fresh / ${health.companies.stale} stale / ${health.companies.total} total`,
  `- Company analysis: ${health.companyAnalysis.completed} / ${health.companyAnalysis.total}`,
  `- Intelligence: ${health.intelligence.completed} analyzed / ${health.intelligence.pending} pending / ${health.intelligence.total} total`,
  `- Independent-source share: ${(health.intelligence.independentShare * 100).toFixed(1)}%`,
  "",
  "### Issues",
  ...(health.issues.length ? health.issues.map((item) => `- **${item.severity.toUpperCase()} · ${item.title}** — ${item.detail}`) : ["- No active issues"]),
];

console.log(lines.join("\n"));
