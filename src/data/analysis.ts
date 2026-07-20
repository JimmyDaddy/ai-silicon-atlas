import snapshot from "./generated/company-analysis.json";

export interface AnalysisPoint {
  text: string;
  evidence: string[];
}

export interface AnalysisSource {
  id: string;
  label: string;
  url: string;
}

export interface CompanyAnalysis {
  status: "ok" | "pending" | "unavailable" | "error";
  inputHash: string;
  generatedAt: string | null;
  model: string | null;
  promptVersion?: string;
  basis?: string;
  summary?: string;
  summaryEvidence?: string[];
  whatChanged?: AnalysisPoint[];
  operatingSignals?: AnalysisPoint[];
  valueChainImpact?: AnalysisPoint[];
  uncertainties?: AnalysisPoint[];
  questionsToWatch?: string[];
  confidence?: "low" | "medium" | "high";
  evidenceSources?: AnalysisSource[];
  reason?: string;
  stale?: boolean;
}

export const analysisSnapshot = snapshot;

export function getCompanyAnalysis(slug: string): CompanyAnalysis | null {
  return (snapshot.companies as Record<string, CompanyAnalysis>)[slug] ?? null;
}

export function analysisStatusLabel(status: CompanyAnalysis["status"]) {
  return {
    ok: "AI 综合分析已生成",
    pending: "等待 AI 分析批次",
    unavailable: "当前证据不足",
    error: "本次 AI 分析异常",
  }[status];
}

