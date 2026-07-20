import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(await readFile(path.join(root, "src/data/generated/news.json"), "utf8"));
const contexts = JSON.parse(await readFile(path.join(root, "src/data/analysis-context.json"), "utf8"));
const errors = [];
const ids = new Set();
const urls = new Set();
const statuses = new Set(["ok", "pending", "error"]);

if (snapshot.schemaVersion !== 1) errors.push("news schemaVersion must be 1");
if (snapshot.promptVersion !== "authority-news-synthesis-v1") errors.push("unexpected news promptVersion");
if (!Array.isArray(snapshot.sources) || !Array.isArray(snapshot.articles)) errors.push("news sources and articles must be arrays");

for (const article of snapshot.articles ?? []) {
  if (!article.id || ids.has(article.id)) errors.push(`invalid or duplicate article id: ${article.id}`);
  ids.add(article.id);
  if (!article.url || urls.has(article.url)) errors.push(`invalid or duplicate article url: ${article.url}`);
  urls.add(article.url);
  if (!article.title || !article.sourceName || !article.publishedAt) errors.push(`${article.id} has incomplete metadata`);
  if (!Array.isArray(article.topics) || article.topics.length === 0) errors.push(`${article.id} has no topics`);
  if (!Array.isArray(article.relatedStages)) errors.push(`${article.id}.relatedStages must be an array`);
  if ((article.relatedCompanies ?? []).some((slug) => !contexts[slug])) errors.push(`${article.id} references unknown company`);
  if (!statuses.has(article.analysis?.status)) errors.push(`${article.id} has invalid analysis status`);
  if (!article.analysis?.inputHash) errors.push(`${article.id} has no analysis inputHash`);
  if (article.analysis?.status === "ok") {
    for (const field of ["titleZh", "summary", "whyItMatters", "generatedAt", "model"]) {
      if (!article.analysis[field]) errors.push(`${article.id}.analysis has no ${field}`);
    }
    for (const field of ["valueChainImpact", "uncertainties"]) {
      if (!Array.isArray(article.analysis[field])) errors.push(`${article.id}.analysis.${field} must be an array`);
    }
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Validated ${snapshot.articles.length} authoritative news articles`);
