import snapshot from "./generated/company-updates.json";

export interface FilingSnapshot {
  form: string;
  filedAt: string;
  reportDate: string | null;
  accessionNumber: string;
  title: string;
  url: string;
}

export interface MetricSnapshot {
  label: string | null;
  value: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string;
  filedAt: string;
  form: string;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
}

export interface CompanyUpdate {
  status: "ok" | "manual" | "unconfigured" | "error";
  provider: string;
  checkedAt: string;
  stale?: boolean;
  sourceUrl?: string;
  latestFiling?: FilingSnapshot | null;
  metrics?: Record<string, MetricSnapshot>;
  warnings?: string[];
}

export const dataSnapshot = snapshot;

export function getCompanyUpdate(slug: string): CompanyUpdate | null {
  return (snapshot.companies as Record<string, CompanyUpdate>)[slug] ?? null;
}

export function formatMetric(metric: MetricSnapshot) {
  const formatted = new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(metric.value);
  return metric.unit === "USD" ? `US$${formatted}` : `${formatted} ${metric.unit}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "尚未生成";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
