import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wait } from "./lib/http.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "src/data/news-sources.json");
const contextPath = path.join(root, "src/data/analysis-context.json");
const outputPath = path.join(root, "src/data/generated/news.json");
const promptVersion = "authority-news-synthesis-v1";
const maxArticles = 120;
const maxFeedItems = 30;

const topicDefinitions = [
  {
    name: "AI 算力与芯片",
    stages: ["design", "memory", "packaging", "ai-infrastructure"],
    keywords: ["gpu", "accelerator", "accelerated computing", "semiconductor", "chip", "blackwell", "hbm", "silicon", "processor", "inference chip", "training chip", "算力", "芯片", "半导体", "加速器"],
  },
  {
    name: "半导体制造",
    stages: ["equipment-materials", "manufacturing", "memory", "packaging"],
    keywords: ["foundry", "fab", "wafer", "lithography", "advanced packaging", "chiplet", "process node", "euv", "晶圆", "制程", "光刻", "封装", "代工"],
  },
  {
    name: "数据中心与电力",
    stages: ["ai-infrastructure"],
    keywords: ["data center", "data centre", "datacenter", "power grid", "electricity", "energy supply", "cooling", "networking", "hyperscaler", "neocloud", "数据中心", "电力", "电网", "散热", "网络"],
  },
  {
    name: "模型与平台",
    stages: ["models-platforms"],
    keywords: ["large language model", "foundation model", "generative ai", "genai", "agentic ai", "ai agent", "model training", "model inference", "cloud ai", "ai safety", "ai standard", "人工智能模型", "大模型", "生成式 ai", "智能体", "模型平台"],
  },
  {
    name: "企业应用与生产力",
    stages: ["ai-applications"],
    keywords: ["productivity", "enterprise adoption", "software firms", "future of work", "automation", "copilot", "workforce", "labor market", "labour market", "生产率", "企业采用", "软件公司", "自动化", "劳动力"],
  },
  {
    name: "资本市场与金融稳定",
    stages: ["models-platforms", "ai-applications"],
    keywords: ["private credit", "financial stability", "capital expenditure", "capex", "investment outlook", "valuation", "credit spread", "bdc", "systemic risk", "私募信贷", "金融稳定", "资本开支", "估值", "信用利差"],
  },
  {
    name: "供应链与地缘政策",
    stages: ["equipment-materials", "manufacturing", "packaging"],
    keywords: ["export control", "supply chain", "trade restriction", "tariff", "industrial policy", "chip act", "geopolitical", "出口管制", "供应链", "关税", "产业政策", "地缘"],
  },
];

const broadKeywords = [
  "artificial intelligence", " ai ", " ai-", "ai infrastructure", "generative ai", "genai", "machine learning",
  "semiconductor", "microelectronics", "chip", "gpu", "hbm", "foundry", "wafer", "data center", "data centre", "hyperscaler",
  "private credit", "software firms", "financial stability", "capital expenditure", "capex", "cloud computing",
  "人工智能", "生成式ai", "生成式 ai", "芯片", "半导体", "算力", "数据中心", "私募信贷",
];

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function decodeEntities(value = "") {
  const named = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlValue(block, names) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

function normalizeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    const url = new URL(decodeEntities(value.trim()), baseUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|ref$|source$|campaign$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return "";
  }
}

function itemLink(block, baseUrl) {
  const rssLink = xmlValue(block, ["link"]);
  if (rssLink && !rssLink.includes("<")) return normalizeUrl(rssLink, baseUrl);
  const atomAlternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    ?? block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return normalizeUrl(atomAlternate?.[1] ?? "", baseUrl);
}

function isoDate(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseFeed(xml, source) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, maxFeedItems).flatMap((block) => {
    const title = stripHtml(xmlValue(block, ["title"]));
    const url = itemLink(block, source.url);
    const publishedAt = isoDate(xmlValue(block, ["pubDate", "published", "updated", "dc:date"]));
    const content = stripHtml(xmlValue(block, ["content:encoded", "content", "description", "summary"]));
    if (!title || !url || !publishedAt) return [];
    return [{ title, url, publishedAt, content }];
  });
}

function normalizedText(value) {
  return ` ${value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ")} `;
}

function includesKeyword(text, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedKeyword.trim() === "ai") return /(?:^|[^a-z])ai(?:[^a-z]|$)/i.test(text);
  return text.includes(normalizedKeyword);
}

function inferTopics(text) {
  const normalized = normalizedText(text);
  return topicDefinitions
    .filter((topic) => topic.keywords.some((keyword) => includesKeyword(normalized, keyword)))
    .map((topic) => topic.name);
}

function isRelevant(title, content) {
  const titleText = normalizedText(title);
  const bodyText = normalizedText(content.slice(0, 8_000));
  const titleHits = broadKeywords.filter((keyword) => includesKeyword(titleText, keyword)).length;
  const bodyHits = broadKeywords.filter((keyword) => includesKeyword(bodyText, keyword)).length;
  return titleHits >= 1 || bodyHits >= 2;
}

function inferCompanies(text, aliases) {
  const normalized = normalizedText(text);
  return Object.entries(aliases).flatMap(([slug, names]) => (
    names.some((name) => includesKeyword(normalized, name)) ? [slug] : []
  ));
}

function inferStages(topics, relatedCompanies, contexts) {
  const values = new Set();
  for (const topic of topicDefinitions) {
    if (topics.includes(topic.name)) topic.stages.forEach((stage) => values.add(stage));
  }
  relatedCompanies.forEach((slug) => {
    if (contexts[slug]?.stage) values.add(contexts[slug].stage);
  });
  return [...values].slice(0, 5);
}

function articleId(sourceId, url) {
  return `${sourceId}-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
}

async function fetchText(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": `AI-Silicon-Atlas/0.1 (+${process.env.DATA_CONTACT_EMAIL || "https://silicon-atlas.timetombs.today"})`,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(source, contexts, aliases, checkedAt) {
  try {
    const xml = await fetchText(source.url, "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5");
    const items = parseFeed(xml, source);
    const articles = items.flatMap((item) => {
      if (!isRelevant(item.title, item.content)) return [];
      const topics = inferTopics(`${item.title} ${item.content}`);
      const relatedCompanies = inferCompanies(`${item.title} ${item.content}`, aliases);
      const relatedStages = inferStages(topics, relatedCompanies, contexts);
      return [{
        id: articleId(source.id, item.url),
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.sourceType,
        sourceHomepage: source.homepage,
        sourcePriority: source.priority,
        title: item.title,
        titleZh: null,
        url: item.url,
        publishedAt: item.publishedAt,
        discoveredAt: checkedAt,
        topics: topics.length ? topics : ["模型与平台"],
        relatedCompanies,
        relatedStages,
        entities: [source.name],
        excerpt: item.content.slice(0, 420),
        editorialSummary: null,
        evidenceText: item.content.slice(0, 12_000),
      }];
    });
    return {
      source: { ...source, status: "ok", checkedAt, itemCount: items.length, matchedCount: articles.length },
      articles,
    };
  } catch (error) {
    return {
      source: { ...source, status: "error", checkedAt, itemCount: 0, matchedCount: 0, error: error instanceof Error ? error.message : String(error) },
      articles: [],
    };
  }
}

function curatedArticle(item, contexts, aliases, checkedAt) {
  const text = `${item.title} ${item.titleZh ?? ""} ${item.evidenceText}`;
  const relatedCompanies = [...new Set([
    ...(item.relatedCompanies ?? []),
    ...inferCompanies(text, aliases),
  ])];
  const topics = item.topics?.length ? item.topics : inferTopics(text);
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceType: item.sourceType,
    sourceHomepage: null,
    sourcePriority: 110,
    title: item.title,
    titleZh: item.titleZh ?? null,
    url: normalizeUrl(item.url),
    publishedAt: isoDate(item.publishedAt),
    discoveredAt: checkedAt,
    topics,
    relatedCompanies,
    relatedStages: item.relatedStages?.length ? item.relatedStages : inferStages(topics, relatedCompanies, contexts),
    entities: item.entities ?? [],
    excerpt: item.evidenceText.slice(0, 420),
    editorialSummary: item.editorialSummary ?? null,
    evidenceText: item.evidenceText.slice(0, 12_000),
  };
}

function parseJsonContent(content) {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function stringList(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 4);
}

function validateModelOutput(raw) {
  for (const field of ["titleZh", "summary", "whyItMatters"]) {
    if (typeof raw?.[field] !== "string" || !raw[field].trim()) throw new Error(`AI response has no ${field}`);
  }
  return {
    titleZh: raw.titleZh.trim(),
    summary: raw.summary.trim(),
    whyItMatters: raw.whyItMatters.trim(),
    valueChainImpact: stringList(raw.valueChainImpact, "valueChainImpact"),
    uncertainties: stringList(raw.uncertainties, "uncertainties"),
    confidence: new Set(["low", "medium", "high"]).has(raw.confidence) ? raw.confidence : "low",
  };
}

async function callModel(article, configuration) {
  const endpoint = `${configuration.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const system = `你是 AI 与半导体产业链情报编辑。只能根据提供的官方标题、来源说明和证据摘录进行归纳，不得补写原文未出现的数字、事件或立场，不得生成买卖建议。必须区分独立机构研究、监管/央行研究与公司自身观点。证据可能只是 RSS 摘要或人工核验后的短摘录，不代表已读取完整正文；不确定处必须写入 uncertainties。输出单个 JSON 对象，字段严格为 titleZh、summary、whyItMatters、valueChainImpact、uncertainties、confidence。valueChainImpact 与 uncertainties 是字符串数组，confidence 只能是 low、medium、high。使用简洁中文。`;
  const packet = {
    sourceName: article.sourceName,
    sourceType: article.sourceType,
    originalTitle: article.title,
    publishedAt: article.publishedAt,
    topics: article.topics,
    relatedCompanies: article.relatedCompanies,
    relatedStages: article.relatedStages,
    evidenceBasis: article.editorialSummary ? "curated-official-key-points" : "official-feed-excerpt",
    evidenceExcerpt: article.evidenceText,
  };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: configuration.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(packet) },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) {
        const requestError = new Error(`AI endpoint returned ${response.status}: ${(await response.text()).slice(0, 400)}`);
        const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
        if (response.status === 429 && Number.isFinite(retryAfter)) requestError.retryAfterMs = Math.min(retryAfter * 1000, 60_000);
        throw requestError;
      }
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("AI endpoint returned no message content");
      return validateModelOutput(parseJsonContent(content));
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(error?.retryAfterMs ?? attempt * 1500);
    }
  }
  throw lastError;
}

const sources = await readJson(sourcePath);
const contexts = await readJson(contextPath);
const previous = await readJson(outputPath, { articles: [], sources: [] });
if (!sources || !contexts) throw new Error("News source configuration is missing");

const checkedAt = new Date().toISOString();
const feedResults = await Promise.all(sources.feeds.map((source) => fetchFeed(source, contexts, sources.companyAliases ?? {}, checkedAt)));
const sourceStatus = feedResults.map((result) => result.source);
const fetchedSourceIds = new Set(sourceStatus.filter((source) => source.status === "ok").map((source) => source.id));
const feedArticles = feedResults.flatMap((result) => result.articles);
const curatedArticles = sources.curated.map((item) => curatedArticle(item, contexts, sources.companyAliases ?? {}, checkedAt));

const previousByUrl = new Map((previous.articles ?? []).map((article) => [normalizeUrl(article.url), article]));
const carryForward = (previous.articles ?? []).filter((article) => (
  !fetchedSourceIds.has(article.sourceId) && !curatedArticles.some((item) => item.url === normalizeUrl(article.url))
));
const unique = new Map();
for (const article of [...carryForward, ...feedArticles, ...curatedArticles]) unique.set(normalizeUrl(article.url), article);

const apiKey = process.env.AI_API_KEY || process.env.GITHUB_TOKEN;
const model = process.env.AI_MODEL || "openai/gpt-4.1-mini";
const baseUrl = process.env.AI_BASE_URL || "https://models.github.ai/inference";
const aiLimit = Number.parseInt(process.env.NEWS_AI_MAX_ARTICLES || "8", 10);
const articles = [...unique.values()]
  .filter((article) => article.url && article.publishedAt)
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || right.sourcePriority - left.sourcePriority)
  .slice(0, maxArticles)
  .map((article) => {
    const inputHash = stableHash({
      promptVersion,
      sourceName: article.sourceName,
      sourceType: article.sourceType,
      title: article.title,
      publishedAt: article.publishedAt,
      topics: article.topics,
      evidenceText: article.evidenceText,
    });
    const old = previousByUrl.get(article.url);
    const analysis = old?.analysis?.status === "ok" && old.analysis.inputHash === inputHash
      ? old.analysis
      : { status: "pending", inputHash, generatedAt: null, model: null, reason: "Waiting for the next AI news batch" };
    const { evidenceText, ...publicArticle } = article;
    return { ...publicArticle, analysis, _evidenceText: evidenceText };
  });

if (apiKey) {
  const candidates = articles
    .filter((article) => article.analysis.status !== "ok")
    .sort((left, right) => Number(Boolean(right.editorialSummary)) - Number(Boolean(left.editorialSummary)) || right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, aiLimit);
  for (const article of candidates) {
    try {
      const synthesis = await callModel({ ...article, evidenceText: article._evidenceText }, { apiKey, model, baseUrl });
      article.titleZh = synthesis.titleZh;
      article.analysis = {
        status: "ok",
        inputHash: article.analysis.inputHash,
        generatedAt: new Date().toISOString(),
        model,
        promptVersion,
        basis: article.editorialSummary ? "curated-official-key-points" : "official-feed-excerpt",
        ...synthesis,
      };
    } catch (error) {
      const old = previousByUrl.get(article.url)?.analysis;
      article.analysis = old?.status === "ok"
        ? { ...old, stale: true, lastAttemptAt: new Date().toISOString(), lastAttemptError: error instanceof Error ? error.message : String(error) }
        : { ...article.analysis, status: "error", lastAttemptAt: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) };
    }
    await wait(350);
  }
}

const publicArticles = articles.map(({ _evidenceText, ...article }) => article);
const completedCount = publicArticles.filter((article) => article.analysis.status === "ok").length;
const configuredSourceCount = new Set([
  ...sources.feeds.map((source) => source.id),
  ...sources.curated.map((article) => article.sourceId),
]).size;
const output = {
  schemaVersion: 1,
  generatedAt: checkedAt,
  provider: apiKey ? (process.env.AI_API_KEY ? "custom-compatible-api" : "github-models") : previous.provider ?? "unconfigured",
  model: apiKey ? model : previous.model ?? null,
  promptVersion,
  completedCount,
  sourceCount: configuredSourceCount,
  sources: sourceStatus,
  articles: publicArticles,
};

await mkdir(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);

console.log(`Collected ${publicArticles.length} relevant articles from ${output.sourceCount} authoritative sources; ${completedCount} have AI synthesis`);
