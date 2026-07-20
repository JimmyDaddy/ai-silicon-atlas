import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generated = path.join(root, "src/data/generated");

async function readJson(name) {
  return JSON.parse(await readFile(path.join(generated, name), "utf8"));
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function issue(severity, code, title, detail) {
  return { severity, code, title, detail };
}

const [data, analysis, news] = await Promise.all([
  readJson("company-updates.json"),
  readJson("company-analysis.json"),
  readJson("news.json"),
]);

const companyEntries = Object.entries(data.companies ?? {});
const companyValues = companyEntries.map(([, company]) => company);
const analysisValues = Object.values(analysis.companies ?? {});
const newsArticles = news.articles ?? [];
const independentArticles = newsArticles.filter((article) => article.sourceType !== "公司观点");
const failedNewsSources = (news.sources ?? []).filter((source) => source.status === "error");
const staleCompanies = companyEntries.filter(([, company]) => company.stale);
const pendingNews = newsArticles.filter((article) => article.analysis?.status !== "ok");
const providerStates = Object.fromEntries(Object.entries(data.sources ?? {}).map(([key, source]) => [key, {
  provider: source.provider,
  status: source.status,
  completedAt: source.completedAt ?? null,
  companyCount: source.companyCount ?? 0,
  completedCount: source.completedCount ?? null,
  failedCount: source.failedCount ?? null,
  error: source.error ?? null,
}]));

const issues = [];
const secState = providerStates.secEdgar;
if (secState?.status === "error") {
  issues.push(issue("critical", "sec-provider-down", "SEC EDGAR 本轮整体不可用", secState.error || "所有 SEC 公司均已回退到上一版快照。"));
} else if (secState?.status === "degraded") {
  issues.push(issue("warning", "sec-provider-degraded", "SEC EDGAR 部分公司更新失败", `${secState.failedCount ?? "部分"} 家公司未完成本轮同步。`));
}

if (staleCompanies.length) {
  const severity = staleCompanies.length >= Math.ceil(companyValues.length / 2) ? "critical" : "warning";
  issues.push(issue(severity, "stale-company-snapshots", `${staleCompanies.length} 家公司正在使用上一版快照`, "远端失败时保留旧数据是预期保护机制，但应尽快恢复来源。"));
}

if (providerStates.openDart?.status === "unconfigured") {
  issues.push(issue("info", "dart-unconfigured", "OpenDART 等待 API Key", "三星电子与 SK 海力士保持待配置状态，不影响其他来源更新。"));
}

if (failedNewsSources.length) {
  issues.push(issue("warning", "news-source-failures", `${failedNewsSources.length} 个新闻源抓取失败`, failedNewsSources.map((source) => source.name).join("、")));
}

if (pendingNews.length) {
  issues.push(issue("warning", "news-analysis-backlog", `${pendingNews.length} 篇情报等待 AI 处理`, "后续批次会继续处理，页面暂时使用来源摘要或编辑要点。"));
}

const unavailableAnalysis = analysisValues.filter((entry) => entry.status === "unavailable").length;
if (unavailableAnalysis) {
  issues.push(issue("info", "company-analysis-unavailable", `${unavailableAnalysis} 家公司当前证据不足`, "人工维护市场或待配置来源不会生成缺少证据的分析。"));
}

const overall = issues.some((item) => item.severity === "critical")
  ? "critical"
  : issues.some((item) => item.severity === "warning") ? "degraded" : "healthy";

const output = {
  schemaVersion: 1,
  generatedAt: [data.generatedAt, analysis.generatedAt, news.generatedAt].filter(Boolean).sort().at(-1),
  overall,
  schedule: { cadence: "daily", cronUtc: "17 2 * * *", timezone: "Asia/Shanghai", localTime: "10:17" },
  companies: {
    total: companyValues.length,
    statuses: countBy(companyValues.map((company) => company.status)),
    fresh: companyValues.filter((company) => company.status === "ok" && !company.stale).length,
    stale: staleCompanies.length,
    withLatestFiling: companyValues.filter((company) => company.latestFiling).length,
    withMetrics: companyValues.filter((company) => Object.keys(company.metrics ?? {}).length).length,
  },
  companyAnalysis: {
    statuses: countBy(analysisValues.map((entry) => entry.status)),
    completed: analysisValues.filter((entry) => entry.status === "ok").length,
    total: analysisValues.length,
  },
  intelligence: {
    total: newsArticles.length,
    completed: newsArticles.filter((article) => article.analysis?.status === "ok").length,
    pending: pendingNews.length,
    independent: independentArticles.length,
    companyViewpoint: newsArticles.length - independentArticles.length,
    independentShare: newsArticles.length ? Number((independentArticles.length / newsArticles.length).toFixed(4)) : 0,
    configuredSources: news.sourceCount ?? 0,
    automaticSources: (news.sources ?? []).length,
    failedSources: failedNewsSources.length,
  },
  providers: providerStates,
  issues,
};

const outputPath = path.join(generated, "health.json");
const temporaryPath = `${outputPath}.tmp`;
await mkdir(generated, { recursive: true });
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);
console.log(`Generated ${overall} data health snapshot with ${issues.length} issue(s)`);
