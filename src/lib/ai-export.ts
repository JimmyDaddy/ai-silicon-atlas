import { analysisSnapshot, getCompanyAnalysis } from "../data/analysis";
import { companies } from "../data/companies";
import { companyProfiles } from "../data/company-profiles";
import { industryMapEdges } from "../data/industry-map";
import { newsArticles, newsDisplaySummary, newsDisplayTitle, newsSnapshot } from "../data/news";
import { stages } from "../data/stages";
import { themes } from "../data/themes";
import { dataSnapshot, getCompanyUpdate } from "../data/updates";

const siteUrl = "https://silicon-atlas.timetombs.today";

export function buildAiExport() {
  return {
    schemaVersion: "1.0",
    metadata: {
      name: "智芯图谱 · AI & Silicon Atlas",
      language: "zh-CN",
      siteUrl,
      generatedAt: newsSnapshot.generatedAt,
      dataGeneratedAt: dataSnapshot.generatedAt,
      analysisGeneratedAt: analysisSnapshot.generatedAt,
      purpose: "供 AI 系统、研究工具和知识库消费的 AI 与半导体产业链结构化上下文。",
      contentBoundary: [
        "内容用于产业信息整理与研究导航，不构成投资建议。",
        "外部文章仅保留标题、本站摘要和原文 URL，不包含文章全文。",
        "公司观点、机构研究和 AI 推断应根据 sourceType、analysisBasis 与原文分别核验。",
        "缺少结构化证据时不会生成公司 AI 分析。",
      ],
      discovery: {
        llmsTxt: `${siteUrl}/llms.txt`,
        json: `${siteUrl}/exports/atlas.json`,
        markdown: `${siteUrl}/exports/atlas.md`,
      },
    },
    valueChain: {
      stages: stages.map((stage) => ({
        id: stage.key,
        index: stage.index,
        name: stage.name,
        nameEn: stage.nameEn,
        description: stage.description,
        trackingSignal: stage.signal,
        companies: companies.filter((company) => company.stage === stage.key).map((company) => company.slug),
      })),
      edges: industryMapEdges,
    },
    researchThemes: themes.map((theme) => ({
      id: theme.slug,
      title: theme.title,
      summary: theme.summary,
      thesis: theme.thesis,
      researchQuestion: theme.question,
      stages: theme.stages,
      mechanism: theme.mechanism,
      indicators: theme.indicators,
      scenarios: theme.scenarios,
      questionsToVerify: theme.verification,
      pageUrl: `${siteUrl}/research/#${theme.slug}`,
    })),
    companies: companies.map((company) => {
      const profile = companyProfiles[company.slug];
      const update = getCompanyUpdate(company.slug);
      const analysis = getCompanyAnalysis(company.slug);
      return {
        id: company.slug,
        name: company.name,
        nameEn: company.nameEn,
        ticker: company.ticker,
        exchange: company.exchange,
        country: company.country,
        stage: company.stage,
        description: company.description,
        focus: company.focus,
        researchAttention: company.attention,
        risks: company.risks,
        profile,
        primarySources: company.sources,
        officialSnapshot: update ? {
          status: update.status,
          provider: update.provider,
          checkedAt: update.checkedAt,
          latestFiling: update.latestFiling ?? null,
          metrics: update.metrics ?? {},
        } : null,
        aiAnalysis: analysis,
        pageUrl: `${siteUrl}/companies/${company.slug}/`,
      };
    }),
    intelligence: newsArticles.map((article) => ({
      id: article.id,
      publishedAt: article.publishedAt,
      source: article.sourceName,
      sourceType: article.sourceType,
      originalTitle: article.title,
      titleZh: newsDisplayTitle(article),
      summaryZh: newsDisplaySummary(article),
      whyItMatters: article.analysis.whyItMatters ?? null,
      valueChainImpact: article.analysis.valueChainImpact ?? [],
      uncertainties: article.analysis.uncertainties ?? [],
      topics: article.topics,
      relatedStages: article.relatedStages,
      relatedCompanies: article.relatedCompanies,
      entities: article.entities,
      analysisStatus: article.analysis.status,
      analysisBasis: article.analysis.basis ?? (article.editorialSummary ? "curated-editorial-summary" : "official-feed-excerpt"),
      model: article.analysis.model,
      sourceUrl: article.url,
    })),
  };
}

function safeMarkdown(value: string | null | undefined) {
  return (value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function buildAiMarkdown() {
  const data = buildAiExport();
  const lines = [
    "# 智芯图谱 AI 上下文导出",
    "",
    `> 生成时间：${data.metadata.generatedAt}。内容用于产业研究导航，不构成投资建议；引用结论前请打开原始来源核验。`,
    "",
    "## 价值链",
    "",
    ...data.valueChain.stages.flatMap((stage) => [
      `### ${stage.index} ${stage.name} / ${stage.nameEn}`,
      "",
      safeMarkdown(stage.description),
      "",
      `跟踪信号：${safeMarkdown(stage.trackingSignal)}`,
      "",
    ]),
    "## 研究主题",
    "",
    ...data.researchThemes.flatMap((theme) => [
      `### ${theme.title}`,
      "",
      `研究命题：${safeMarkdown(theme.thesis)}`,
      "",
      `核心问题：${safeMarkdown(theme.researchQuestion)}`,
      "",
      "传导机制：",
      ...theme.mechanism.map((step, index) => `${index + 1}. **${step.label}**：${safeMarkdown(step.description)}`),
      "",
      "待核验问题：",
      ...theme.questionsToVerify.map((question) => `- ${safeMarkdown(question)}`),
      "",
    ]),
    "## 公司索引",
    "",
    "| 公司 | 证券 | 环节 | 简介 | 页面 |",
    "| --- | --- | --- | --- | --- |",
    ...data.companies.map((company) => `| ${safeMarkdown(company.name)} | ${safeMarkdown(company.ticker)} · ${safeMarkdown(company.exchange)} | ${safeMarkdown(company.stage)} | ${safeMarkdown(company.description)} | [研究卡](${company.pageUrl}) |`),
    "",
    "## 最新权威情报",
    "",
    ...data.intelligence.flatMap((article) => [
      `### ${safeMarkdown(article.titleZh)}`,
      "",
      `- 日期：${article.publishedAt.slice(0, 10)}`,
      `- 来源：${safeMarkdown(article.source)}（${safeMarkdown(article.sourceType)}）`,
      `- 主题：${article.topics.map(safeMarkdown).join("、")}`,
      `- 摘要：${safeMarkdown(article.summaryZh)}`,
      article.whyItMatters ? `- 重要性：${safeMarkdown(article.whyItMatters)}` : "- 重要性：等待 AI 综合分析",
      `- 原文：${article.sourceUrl}`,
      "",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

export function buildLlmsTxt() {
  return `# 智芯图谱 · AI & Silicon Atlas

> 中文 AI 与半导体产业链研究索引，覆盖九个价值链环节、代表公司、权威情报、研究主题和证据受限的 AI 摘要。

## AI-readable exports

- [完整结构化 JSON](${siteUrl}/exports/atlas.json): 价值链、公司、研究主题、官方快照与权威情报的机器可读数据。
- [上下文 Markdown](${siteUrl}/exports/atlas.md): 适合注入 LLM 上下文或导入知识库的文本摘要。

## Core pages

- [产业地图](${siteUrl}/map/)
- [公司目录](${siteUrl}/companies/)
- [权威情报时间线](${siteUrl}/news/)
- [交互研究主题](${siteUrl}/research/)
- [方法与来源](${siteUrl}/methodology/)
- [数据更新状态](${siteUrl}/updates/)

## Usage notes

- 本站不提供投资建议、评级、目标价或收益承诺。
- 外部文章只提供本站摘要与原文链接，不提供全文转载。
- 请保留 sourceUrl、sourceType、analysisStatus 与 analysisBasis，并在高风险结论前核验原始来源。
`;
}

