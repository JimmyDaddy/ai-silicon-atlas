import snapshot from "./generated/health.json";

export type HealthStatus = "healthy" | "degraded" | "critical";
export type HealthSeverity = "info" | "warning" | "critical";

export interface HealthIssue {
  severity: HealthSeverity;
  code: string;
  title: string;
  detail: string;
}

export interface HealthSnapshot {
  schemaVersion: number;
  generatedAt: string;
  overall: HealthStatus;
  schedule: { cadence: string; cronUtc: string; timezone: string; localTime: string };
  companies: {
    total: number;
    statuses: Record<string, number>;
    fresh: number;
    stale: number;
    withLatestFiling: number;
    withMetrics: number;
  };
  companyAnalysis: { statuses: Record<string, number>; completed: number; total: number };
  intelligence: {
    total: number;
    completed: number;
    pending: number;
    independent: number;
    companyViewpoint: number;
    independentShare: number;
    configuredSources: number;
    automaticSources: number;
    failedSources: number;
  };
  providers: Record<string, {
    provider: string;
    status: string;
    completedAt: string | null;
    companyCount: number;
    completedCount: number | null;
    failedCount: number | null;
    error: string | null;
  }>;
  issues: HealthIssue[];
}

export const healthSnapshot = snapshot as HealthSnapshot;

export const healthStatusLabel: Record<HealthStatus, string> = {
  healthy: "运行正常",
  degraded: "降级运行",
  critical: "需要处理",
};
