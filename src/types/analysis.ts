import type { Category } from "./transaction";
import type { ProStatus, Tier } from "./tier";

export interface CategoryBreakdown {
  category: Category;
  total: string;
  count: number;
}

export interface TrendPoint {
  period: string;
  total: string;
}

export interface Anomaly {
  kind: "subscription_leak" | "outlier" | string;
  merchant: string;
  detail: string;
}

export interface FreeAnalysis {
  byCategory: CategoryBreakdown[];
  trend: TrendPoint[];
  anomalies: Anomaly[];
}

export interface ProInsights {
  summary: string;
  insights: string[];
}

export interface AnalyzeResponse {
  tier: Tier;
  free: FreeAnalysis;
  pro: {
    status: ProStatus;
    insights?: ProInsights;
  };
  warnings?: string[];
}
