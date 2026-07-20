import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wait } from "./lib/http.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(root, "src/data/generated/company-updates.json");
const contextPath = path.join(root, "src/data/analysis-context.json");
const outputPath = path.join(root, "src/data/generated/company-analysis.json");
const promptVersion = "company-synthesis-v2";
const unsupportedAbsencePattern = /(?:无重大.{0,20}(?:披露|事项|变动|变化|风险)|(?:未显示|未披露|没有|不存在).{0,20}(?:事项|变化|变动|风险)|(?:披露|报告|公告|8-K|6-K|10-[KQ]).{0,20}(?:未显示|未披露|没有|不存在|无重大))/i;

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

function metricDeltas(metricHistory = {}) {
  return Object.fromEntries(
    Object.entries(metricHistory).map(([name, periods]) => {
      const [latest, previous] = periods;
      const changePercent = previous?.value
        ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100
        : null;
      return [name, {
        latest,
        previous: previous ?? null,
        changePercent: Number.isFinite(changePercent) ? Number(changePercent.toFixed(2)) : null,
      }];
    }),
  );
}

function evidencePacket(slug, context, company) {
  const filings = (company.recentFilings ?? []).slice(0, 4);
  const sources = filings.map((filing) => ({
    id: `filing:${filing.accessionNumber}`,
    label: `${filing.form} · ${filing.filedAt}`,
    url: filing.url,
  }));

  if (company.identifiers?.cik) {
    sources.push({
      id: "company-facts",
      label: "SEC Company Facts",
      url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${company.identifiers.cik}.json`,
    });
  }

  return {
    company: { slug, ...context, entityName: company.entityName ?? context.name },
    latestFiling: company.latestFiling ?? null,
    recentFilings: filings.map((filing) => ({
      evidenceId: `filing:${filing.accessionNumber}`,
      form: filing.form,
      filedAt: filing.filedAt,
      reportDate: filing.reportDate,
      title: filing.title,
    })),
    metrics: company.metrics ?? {},
    metricDeltas: metricDeltas(company.metricHistory),
    evidenceSources: sources,
    evidenceLimitations: [
      "recentFilings 只包含表单类型、日期和标题等元数据，不包含申报文件正文。",
      "不得根据披露元数据断言公告未披露、未显示或不存在某类事项。",
    ],
  };
}

function parseJsonContent(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

function pointArray(value, field, allowedEvidence) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.slice(0, 4).map((point) => {
    if (!point || typeof point.text !== "string" || !point.text.trim()) {
      throw new Error(`${field} contains an invalid point`);
    }
    const evidence = Array.isArray(point.evidence) ? [...new Set(point.evidence)] : [];
    if (evidence.some((id) => !allowedEvidence.has(id))) {
      throw new Error(`${field} references unknown evidence`);
    }
    return { text: point.text.trim(), evidence };
  });
}

function validateModelOutput(raw, packet) {
  if (!raw || typeof raw.summary !== "string" || !raw.summary.trim()) {
    throw new Error("AI response has no summary");
  }

  const allowedEvidence = new Set(packet.evidenceSources.map((source) => source.id));
  const summaryEvidence = Array.isArray(raw.summaryEvidence) ? [...new Set(raw.summaryEvidence)] : [];
  if (summaryEvidence.some((id) => !allowedEvidence.has(id))) {
    throw new Error("Summary references unknown evidence");
  }

  const confidence = new Set(["low", "medium", "high"]).has(raw.confidence) ? raw.confidence : "low";
  const questions = Array.isArray(raw.questionsToWatch)
    ? raw.questionsToWatch.filter((item) => typeof item === "string" && item.trim()).slice(0, 4)
    : [];

  const allClaims = [
    raw.summary,
    ...["whatChanged", "operatingSignals", "valueChainImpact", "uncertainties"]
      .flatMap((field) => Array.isArray(raw[field]) ? raw[field].map((point) => point?.text) : []),
  ].filter((claim) => typeof claim === "string");
  if (allClaims.some((claim) => unsupportedAbsencePattern.test(claim))) {
    throw new Error("AI response infers the absence of events from filing metadata");
  }

  return {
    summary: raw.summary.trim(),
    summaryEvidence,
    whatChanged: pointArray(raw.whatChanged, "whatChanged", allowedEvidence),
    operatingSignals: pointArray(raw.operatingSignals, "operatingSignals", allowedEvidence),
    valueChainImpact: pointArray(raw.valueChainImpact, "valueChainImpact", allowedEvidence),
    uncertainties: pointArray(raw.uncertainties, "uncertainties", allowedEvidence),
    questionsToWatch: questions,
    confidence,
  };
}

async function callModel(packet, configuration) {
  const endpoint = `${configuration.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const evidenceIds = packet.evidenceSources.map((source) => source.id);
  const system = `你是 AI 与半导体产业情报分析器。只能依据用户提供的结构化证据，不得补写公告正文中没有出现的事实，不得给出买入、卖出、目标价或收益预测。recentFilings 只有披露元数据，没有文件正文；绝对不能据此声称公告“未显示”“未披露”“没有”或“不存在”某类事项。需要谈及正文时，必须表述为“当前证据包不含披露正文，无法判断具体事项”。\n
输出单个 JSON 对象，字段必须是：summary、summaryEvidence、whatChanged、operatingSignals、valueChainImpact、uncertainties、questionsToWatch、confidence。\n
whatChanged、operatingSignals、valueChainImpact、uncertainties 都是对象数组，每项格式 {"text":"...","evidence":["证据ID"]}。questionsToWatch 是字符串数组。confidence 只能是 low、medium、high。\n
证据不足时明确写入 uncertainties，不要用常识填空。使用简洁中文。`;
  const user = `可用证据 ID：${JSON.stringify(evidenceIds)}\n\n证据包：\n${JSON.stringify(packet)}`;

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
            { role: "user", content: user },
          ],
          temperature: 0.1,
          max_tokens: 1800,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`AI endpoint returned ${response.status}: ${detail}`);
      }

      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("AI endpoint returned no message content");
      return validateModelOutput(parseJsonContent(content), packet);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1200);
    }
  }

  throw lastError;
}

const snapshot = await readJson(snapshotPath);
const contexts = await readJson(contextPath);
const previous = await readJson(outputPath, { companies: {} });
if (!snapshot || !contexts) throw new Error("Analysis input files are missing");

const apiKey = process.env.AI_API_KEY || process.env.GITHUB_TOKEN;
const model = process.env.AI_MODEL || "openai/gpt-4.1";
const baseUrl = process.env.AI_BASE_URL || "https://models.github.ai/inference";
const maxCompanies = Number.parseInt(process.env.AI_MAX_COMPANIES || "8", 10);
const generatedAt = new Date().toISOString();
const candidates = [];
const companies = {};

for (const [slug, context] of Object.entries(contexts)) {
  const company = snapshot.companies?.[slug];
  if (!company) continue;
  const packet = evidencePacket(slug, context, company);
  const inputHash = stableHash({ promptVersion, packet });
  const old = previous.companies?.[slug];

  if (old?.status === "ok" && old.inputHash === inputHash) {
    companies[slug] = old;
    continue;
  }

  const analyzable = company.status === "ok" && packet.evidenceSources.length > 0;
  companies[slug] = {
    status: analyzable ? "pending" : "unavailable",
    inputHash,
    generatedAt: null,
    model: null,
    reason: analyzable ? "Waiting for the next AI analysis batch" : `Source status: ${company.status}`,
  };

  if (analyzable) {
    candidates.push({ slug, packet, inputHash, filedAt: company.latestFiling?.filedAt ?? "" });
  }
}

candidates.sort((left, right) => right.filedAt.localeCompare(left.filedAt));

if (apiKey) {
  for (const candidate of candidates.slice(0, maxCompanies)) {
    try {
      const analysis = await callModel(candidate.packet, { apiKey, model, baseUrl });
      companies[candidate.slug] = {
        status: "ok",
        inputHash: candidate.inputHash,
        generatedAt: new Date().toISOString(),
        model,
        promptVersion,
        basis: "structured-official-data",
        evidenceSources: candidate.packet.evidenceSources,
        ...analysis,
      };
    } catch (error) {
      const old = previous.companies?.[candidate.slug];
      companies[candidate.slug] = old?.status === "ok"
        ? {
            ...old,
            stale: true,
            lastAttemptAt: new Date().toISOString(),
            lastAttemptError: error instanceof Error ? error.message : String(error),
          }
        : {
            ...companies[candidate.slug],
            status: "error",
            lastAttemptAt: new Date().toISOString(),
            reason: error instanceof Error ? error.message : String(error),
          };
    }
    await wait(500);
  }
}

const completedCount = Object.values(companies).filter((entry) => entry.status === "ok").length;
const output = {
  schemaVersion: 1,
  generatedAt: apiKey ? generatedAt : previous.generatedAt ?? null,
  provider: apiKey ? (process.env.AI_API_KEY ? "custom-compatible-api" : "github-models") : "unconfigured",
  model: apiKey ? model : previous.model ?? null,
  promptVersion,
  completedCount,
  companies,
};

await mkdir(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);

console.log(apiKey
  ? `AI analysis completed for ${completedCount}/${Object.keys(contexts).length} companies with ${model}`
  : "AI analysis prepared in pending mode; no API token is configured locally");
