import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateSecCompanies } from "./providers/sec-edgar.mjs";
import { updateDartCompanies } from "./providers/opendart.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const identifiersPath = path.join(root, "src/data/company-identifiers.json");
const outputPath = path.join(root, "src/data/generated/company-updates.json");
const onlySec = process.argv.includes("--only-sec");
const skipSec = process.argv.includes("--skip-sec");

if (onlySec && skipSec) {
  throw new Error("--only-sec and --skip-sec cannot be used together");
}

const updateMode = onlySec ? "sec-only" : skipSec ? "hosted" : "all";

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function manualEntry(identifiers, checkedAt) {
  return {
    status: "manual",
    provider: "First-party IR",
    checkedAt,
    identifiers: {},
    sourceUrl: identifiers.manualSource,
    latestFiling: null,
    recentFilings: [],
    metrics: {},
    metricHistory: {},
    warnings: ["No automated official adapter is configured for this market yet"],
  };
}

function preserveLastGood(next, previous) {
  if (!previous || previous.status !== "ok" || next.status === "ok") return next;
  if (!new Set(["error", "unconfigured"]).has(next.status)) return next;

  return {
    ...previous,
    stale: true,
    lastAttemptAt: next.checkedAt,
    warnings: [
      ...(previous.warnings ?? []).filter((warning) => !warning.startsWith("Latest refresh failed;")),
      `Latest refresh failed; preserved last good snapshot: ${next.warnings?.join("; ") || next.status}`,
    ],
  };
}

function missingProviderEntry(config, sources, checkedAt) {
  if (config.secTicker) {
    return {
      status: "error",
      provider: "SEC EDGAR",
      checkedAt,
      identifiers: { ticker: config.secTicker },
      latestFiling: null,
      recentFilings: [],
      metrics: {},
      metricHistory: {},
      warnings: [sources.secEdgar.error || "SEC EDGAR returned no company result"],
    };
  }

  if (config.dartCorpCode) {
    return {
      status: sources.openDart.status === "unconfigured" ? "unconfigured" : "error",
      provider: "OpenDART",
      checkedAt,
      identifiers: { corpCode: config.dartCorpCode },
      latestFiling: null,
      recentFilings: [],
      metrics: {},
      metricHistory: {},
      warnings: [sources.openDart.error || "OpenDART returned no company result"],
    };
  }

  if (config.manualSource) return manualEntry(config, checkedAt);

  return {
    status: "error",
    provider: "Unknown",
    checkedAt,
    identifiers: {},
    latestFiling: null,
    recentFilings: [],
    metrics: {},
    metricHistory: {},
    warnings: ["No data provider is configured for this company"],
  };
}

const identifiers = await readJson(identifiersPath);
const previous = await readJson(outputPath, { companies: {} });
const generatedAt = new Date().toISOString();

if (!identifiers || typeof identifiers !== "object") {
  throw new Error("Company identifier registry is missing or invalid");
}

function preservedProvider(key, provider) {
  return previous.sources?.[key] ?? {
    status: "unconfigured",
    provider,
    completedAt: null,
    companyCount: 0,
    error: `No previous ${provider} snapshot is available`,
  };
}

const [sec, dart] = await Promise.all([
  skipSec
    ? Promise.resolve({ source: preservedProvider("secEdgar", "SEC EDGAR"), results: {} })
    : updateSecCompanies(identifiers, previous.companies),
  onlySec
    ? Promise.resolve({ source: preservedProvider("openDart", "OpenDART"), results: {} })
    : updateDartCompanies(identifiers),
]);

const sources = { secEdgar: sec.source, openDart: dart.source };

const companies = {};
for (const slug of Object.keys(identifiers).sort()) {
  const config = identifiers[slug];
  let next;
  if (config.secTicker && skipSec) {
    next = previous.companies?.[slug] ?? missingProviderEntry(config, sources, generatedAt);
  } else if (config.dartCorpCode && onlySec) {
    next = previous.companies?.[slug] ?? missingProviderEntry(config, sources, generatedAt);
  } else if (config.manualSource && onlySec) {
    next = previous.companies?.[slug] ?? manualEntry(config, generatedAt);
  } else {
    next = sec.results[slug] ?? dart.results[slug] ?? missingProviderEntry(config, sources, generatedAt);
  }
  companies[slug] = preserveLastGood(next, previous.companies?.[slug]);
}

const output = {
  schemaVersion: 1,
  generatedAt,
  sources: {
    ...sources,
    manual: onlySec
      ? preservedProvider("manual", "First-party IR")
      : {
          status: "manual",
          provider: "First-party IR",
          completedAt: generatedAt,
          companyCount: Object.values(identifiers).filter((item) => item.manualSource).length,
        },
  },
  companies,
};

await mkdir(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);

const summary = Object.values(companies).reduce((counts, company) => {
  counts[company.status] = (counts[company.status] ?? 0) + 1;
  return counts;
}, {});

console.log(`Data snapshot updated at ${generatedAt} (${updateMode})`);
console.log(JSON.stringify(summary));
