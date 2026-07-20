import snapshot from "./generated/delta.json";

export interface DeltaFiling {
  company: string;
  stage: string | null;
  form: string;
  filedAt: string;
  reportDate: string | null;
  accessionNumber: string;
  title: string;
  url: string;
}

export interface DeltaMetric {
  company: string;
  stage: string | null;
  metric: string;
  label: string | null;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  unit: string;
  periodEnd: string;
  previousPeriodEnd: string | null;
  sourceForm: string;
}

export interface DeltaNews {
  id: string;
  publishedAt: string;
  source: string;
  sourceType: string;
  title: string;
  summary: string;
  topics: string[];
  relatedCompanies: string[];
  relatedStages: string[];
  analysisStatus: string;
  sourceUrl: string;
}

export interface DeltaSnapshot {
  schemaVersion: number;
  generatedAt: string;
  period: { from: string | null; to: string; baseRef: string };
  summary: {
    newFilings: number;
    metricChanges: number;
    companyStatusChanges: number;
    companyAnalysisRefreshes: number;
    newIntelligence: number;
    intelligenceAnalysisRefreshes: number;
    totalChanges: number;
  };
  affected: { stages: Record<string, number>; topics: Record<string, number> };
  companies: {
    filings: DeltaFiling[];
    metrics: DeltaMetric[];
    statuses: Array<{ company: string; stage: string | null; from: { status: string; stale: boolean } | null; to: { status: string; stale: boolean } }>;
    analysis: Array<{ company: string; stage: string | null; generatedAt: string; model: string; confidence: string | null; summary: string }>;
  };
  intelligence: {
    new: DeltaNews[];
    analysisRefreshed: Array<{ id: string; source: string; title: string; relatedCompanies: string[]; relatedStages: string[]; generatedAt: string }>;
  };
}

export const deltaSnapshot = snapshot as DeltaSnapshot;
