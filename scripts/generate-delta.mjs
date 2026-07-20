import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generated = path.join(root, "src/data/generated");
const baseRef = process.env.DELTA_BASE_REF || "HEAD";

async function readCurrent(name) {
  return JSON.parse(await readFile(path.join(generated, name), "utf8"));
}

function readPrevious(name) {
  try {
    const value = execFileSync("git", ["show", `${baseRef}:src/data/generated/${name}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function percentChange(current, previous) {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
}

const [data, analysis, news, contexts] = await Promise.all([
  readCurrent("company-updates.json"),
  readCurrent("company-analysis.json"),
  readCurrent("news.json"),
  JSON.parse(await readFile(path.join(root, "src/data/analysis-context.json"), "utf8")),
]);
const previousData = readPrevious("company-updates.json") ?? { companies: {} };
const previousAnalysis = readPrevious("company-analysis.json") ?? { companies: {} };
const previousNews = readPrevious("news.json") ?? { articles: [] };

const filings = [];
const metrics = [];
const companyStatuses = [];
const companyAnalysis = [];

for (const [slug, current] of Object.entries(data.companies ?? {})) {
  const previous = previousData.companies?.[slug];
  if (current.latestFiling && current.latestFiling.accessionNumber !== previous?.latestFiling?.accessionNumber) {
    filings.push({ company: slug, stage: contexts[slug]?.stage ?? null, ...current.latestFiling });
  }

  for (const [metric, value] of Object.entries(current.metrics ?? {})) {
    const old = previous?.metrics?.[metric];
    if (!old || old.periodEnd !== value.periodEnd || old.value !== value.value) {
      metrics.push({
        company: slug,
        stage: contexts[slug]?.stage ?? null,
        metric,
        label: value.label,
        value: value.value,
        previousValue: old?.value ?? null,
        changePercent: percentChange(value.value, old?.value),
        unit: value.unit,
        periodEnd: value.periodEnd,
        previousPeriodEnd: old?.periodEnd ?? null,
        sourceForm: value.form,
      });
    }
  }

  const previousEffectiveStatus = previous ? `${previous.status}:${Boolean(previous.stale)}` : null;
  const currentEffectiveStatus = `${current.status}:${Boolean(current.stale)}`;
  if (previousEffectiveStatus !== currentEffectiveStatus) {
    companyStatuses.push({
      company: slug,
      stage: contexts[slug]?.stage ?? null,
      from: previous ? { status: previous.status, stale: Boolean(previous.stale) } : null,
      to: { status: current.status, stale: Boolean(current.stale) },
    });
  }

  const currentAnalysis = analysis.companies?.[slug];
  const oldAnalysis = previousAnalysis.companies?.[slug];
  if (currentAnalysis?.status === "ok" && (!oldAnalysis || oldAnalysis.inputHash !== currentAnalysis.inputHash || oldAnalysis.status !== "ok")) {
    companyAnalysis.push({
      company: slug,
      stage: contexts[slug]?.stage ?? null,
      generatedAt: currentAnalysis.generatedAt,
      model: currentAnalysis.model,
      confidence: currentAnalysis.confidence ?? null,
      summary: currentAnalysis.summary ?? "",
    });
  }
}

const previousNewsById = new Map((previousNews.articles ?? []).map((article) => [article.id, article]));
const newIntelligence = [];
const refreshedIntelligence = [];
for (const article of news.articles ?? []) {
  const old = previousNewsById.get(article.id);
  if (!old) {
    newIntelligence.push({
      id: article.id,
      publishedAt: article.publishedAt,
      source: article.sourceName,
      sourceType: article.sourceType,
      title: article.analysis?.titleZh || article.titleZh || article.title,
      summary: article.analysis?.summary || article.editorialSummary || article.excerpt,
      topics: article.topics,
      relatedCompanies: article.relatedCompanies,
      relatedStages: article.relatedStages,
      analysisStatus: article.analysis?.status,
      sourceUrl: article.url,
    });
  } else if (article.analysis?.status === "ok" && (old.analysis?.status !== "ok" || old.analysis?.inputHash !== article.analysis?.inputHash)) {
    refreshedIntelligence.push({
      id: article.id,
      source: article.sourceName,
      title: article.analysis.titleZh || article.titleZh || article.title,
      relatedCompanies: article.relatedCompanies,
      relatedStages: article.relatedStages,
      generatedAt: article.analysis.generatedAt,
    });
  }
}

const stageCounts = {};
const topicCounts = {};
for (const stage of [
  ...filings.map((item) => item.stage),
  ...metrics.map((item) => item.stage),
  ...companyStatuses.map((item) => item.stage),
  ...companyAnalysis.map((item) => item.stage),
  ...newIntelligence.flatMap((item) => item.relatedStages),
  ...refreshedIntelligence.flatMap((item) => item.relatedStages),
]) {
  if (stage) stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
}
for (const topic of newIntelligence.flatMap((item) => item.topics)) topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;

const output = {
  schemaVersion: 1,
  generatedAt: [data.generatedAt, analysis.generatedAt, news.generatedAt].filter(Boolean).sort().at(-1),
  period: {
    from: [previousData.generatedAt, previousAnalysis.generatedAt, previousNews.generatedAt].filter(Boolean).sort().at(-1) ?? null,
    to: [data.generatedAt, analysis.generatedAt, news.generatedAt].filter(Boolean).sort().at(-1),
    baseRef,
  },
  summary: {
    newFilings: filings.length,
    metricChanges: metrics.length,
    companyStatusChanges: companyStatuses.length,
    companyAnalysisRefreshes: companyAnalysis.length,
    newIntelligence: newIntelligence.length,
    intelligenceAnalysisRefreshes: refreshedIntelligence.length,
    totalChanges: filings.length + metrics.length + companyStatuses.length + companyAnalysis.length + newIntelligence.length + refreshedIntelligence.length,
  },
  affected: { stages: stageCounts, topics: topicCounts },
  companies: { filings, metrics, statuses: companyStatuses, analysis: companyAnalysis },
  intelligence: { new: newIntelligence, analysisRefreshed: refreshedIntelligence },
};

const outputPath = path.join(generated, "delta.json");
const temporaryPath = `${outputPath}.tmp`;
await mkdir(generated, { recursive: true });
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);
console.log(`Generated delta with ${output.summary.totalChanges} change(s) from ${baseRef}`);
