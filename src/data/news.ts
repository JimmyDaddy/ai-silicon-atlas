import snapshot from "./generated/news.json";

export interface NewsAnalysis {
  status: "ok" | "pending" | "error";
  inputHash: string;
  generatedAt: string | null;
  model: string | null;
  promptVersion?: string;
  basis?: "curated-official-key-points" | "official-feed-excerpt";
  titleZh?: string;
  summary?: string;
  whyItMatters?: string;
  valueChainImpact?: string[];
  uncertainties?: string[];
  confidence?: "low" | "medium" | "high";
  reason?: string;
  stale?: boolean;
}

export interface NewsArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceHomepage: string | null;
  sourcePriority: number;
  title: string;
  titleZh: string | null;
  url: string;
  publishedAt: string;
  discoveredAt: string;
  topics: string[];
  relatedCompanies: string[];
  relatedStages: string[];
  entities: string[];
  excerpt: string;
  editorialSummary: string | null;
  analysis: NewsAnalysis;
}

export interface NewsSourceStatus {
  id: string;
  name: string;
  sourceType: string;
  url: string;
  homepage: string;
  status: "ok" | "error";
  checkedAt: string;
  itemCount: number;
  matchedCount: number;
  error?: string;
}

export const newsSnapshot = snapshot;
export const newsArticles = snapshot.articles as NewsArticle[];
export const newsSourceStatuses = snapshot.sources as NewsSourceStatus[];
export const newsTopics = [...new Set(newsArticles.flatMap((article) => article.topics))];
export const newsSourceTypes = [...new Set(newsArticles.map((article) => article.sourceType))];

export function newsDisplayTitle(article: NewsArticle) {
  return article.analysis.status === "ok" && article.analysis.titleZh
    ? article.analysis.titleZh
    : article.titleZh ?? article.title;
}

export function newsDisplaySummary(article: NewsArticle) {
  return article.analysis.status === "ok" && article.analysis.summary
    ? article.analysis.summary
    : article.editorialSummary ?? article.excerpt;
}

export function newsAnalysisLabel(article: NewsArticle) {
  if (article.analysis.status === "ok") return article.analysis.stale ? "AI 摘要 · 待刷新" : "AI 综合摘要";
  if (article.analysis.status === "error") return "来源要点 · AI 待重试";
  return article.editorialSummary ? "编辑核验 · AI 待处理" : "来源摘要 · AI 待处理";
}

