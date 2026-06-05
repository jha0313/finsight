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

export type AnomalyKind =
  | "annual_cost"
  | "price_hike"
  | "duplicate_subscription"
  | "dormant_subscription"
  | "double_charge"
  | "category_outlier"
  | "new_high_merchant"
  | "category_surge";

export type AnomalySeverity = "high" | "warn" | "info";

export interface Anomaly {
  kind: AnomalyKind;
  severity: AnomalySeverity;
  merchant: string;
  detail: string;
  amount?: string;
  amountLabel?: string;
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
  // 명세서의 청구 통화(거래에서 도출). 화면 금액 포맷에 쓰인다. 거래가 없거나
  // 통화를 알 수 없으면 생략되고, 표시부는 기본값(KRW)으로 강등한다.
  currency?: string;
  free: FreeAnalysis;
  pro: {
    status: ProStatus;
    insights?: ProInsights;
  };
  warnings?: string[];
}
