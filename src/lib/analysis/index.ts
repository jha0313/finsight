import type { Anomaly, AnomalyKind, FreeAnalysis } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

import { compareMoney, sumMoney } from "@/lib/money";

import { detectAnnualCost } from "./anomalies/annual-cost";
import { detectCategoryOutliers } from "./anomalies/category-outlier";
import { detectCategorySurge } from "./anomalies/category-surge";
import { detectDormantSubscriptions } from "./anomalies/dormant-subscriptions";
import { detectDoubleCharge } from "./anomalies/double-charge";
import { detectDuplicateSubscriptions } from "./anomalies/duplicate-subscriptions";
import { detectNewHighMerchants } from "./anomalies/new-high-merchant";
import { detectPriceHike } from "./anomalies/price-hike";
import {
  isDebitSpend,
  monthlyPeriod,
  normalizeMerchant,
} from "./anomalies/shared";

const CATEGORY_ORDER: Category[] = [
  "food",
  "transport",
  "shopping",
  "utilities",
  "entertainment",
  "health",
  "finance",
  "income",
  "other",
];

// sortAnomalies의 kind 정렬 키. detector 호출 순서와 동일하게 고정한다.
const ANOMALY_KIND_ORDER: AnomalyKind[] = [
  "annual_cost",
  "price_hike",
  "duplicate_subscription",
  "dormant_subscription",
  "double_charge",
  "category_outlier",
  "new_high_merchant",
  "category_surge",
];

const SEVERITY_ORDER: Anomaly["severity"][] = ["high", "warn", "info"];

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  food: [
    "스타벅스",
    "카페",
    "cafe",
    "coffee",
    "restaurant",
    "식당",
    "배달",
    "편의점",
    "맥도날드",
  ],
  transport: [
    "korail",
    "train",
    "지하철",
    "버스",
    "택시",
    "taxi",
    "uber",
    "철도",
    "교통",
  ],
  shopping: [
    "쇼핑",
    "쿠팡",
    "amazon",
    "올리브영",
    "oliveyoung",
    "mall",
    "마트",
    "store",
  ],
  utilities: [
    "관리비",
    "전기",
    "가스",
    "수도",
    "통신",
    "utility",
    "internet",
    "mobile",
  ],
  entertainment: [
    "netflix",
    "youtube",
    "spotify",
    "disney",
    "tving",
    "wavve",
    "영화",
    "cinema",
    "멜론",
  ],
  health: [
    "약국",
    "병원",
    "의원",
    "clinic",
    "pharmacy",
    "doctor",
    "health",
  ],
  finance: [
    "은행",
    "수수료",
    "이자",
    "보험",
    "bank",
    "fee",
    "interest",
    "loan",
  ],
  income: ["월급", "급여", "salary", "payroll", "income"],
  other: [],
};

type Bucket = {
  amounts: string[];
  count: number;
};

export function categorize(merchant: string): Category {
  const normalized = normalizeMerchant(merchant);

  for (const category of CATEGORY_ORDER) {
    if (
      CATEGORY_KEYWORDS[category].some((keyword) =>
        normalized.includes(keyword),
      )
    ) {
      return category;
    }
  }

  return "other";
}

export function analyze(transactions: Transaction[]): FreeAnalysis {
  const debit = transactions.filter(isDebitSpend);

  return {
    byCategory: summarizeByCategory(debit),
    trend: summarizeTrend(debit),
    anomalies: sortAnomalies([
      ...detectAnnualCost(debit),
      ...detectPriceHike(debit),
      ...detectDuplicateSubscriptions(debit),
      ...detectDormantSubscriptions(debit),
      ...detectDoubleCharge(debit),
      ...detectCategoryOutliers(debit),
      ...detectNewHighMerchants(debit),
      ...detectCategorySurge(debit),
    ]),
  };
}

// 결정론적 안정 정렬: severity(high<warn<info) → kind(고정 순서) →
// merchant → detail.
export function sortAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return [...anomalies].sort((left, right) => {
    const severityOrder =
      SEVERITY_ORDER.indexOf(left.severity) -
      SEVERITY_ORDER.indexOf(right.severity);

    if (severityOrder !== 0) {
      return severityOrder;
    }

    const kindOrder =
      ANOMALY_KIND_ORDER.indexOf(left.kind) -
      ANOMALY_KIND_ORDER.indexOf(right.kind);

    if (kindOrder !== 0) {
      return kindOrder;
    }

    const merchantOrder = left.merchant.localeCompare(right.merchant);

    if (merchantOrder !== 0) {
      return merchantOrder;
    }

    return left.detail.localeCompare(right.detail);
  });
}

function summarizeByCategory(
  transactions: Transaction[],
): FreeAnalysis["byCategory"] {
  const buckets = new Map<Category, Bucket>();

  for (const transaction of transactions) {
    const category = categorize(transaction.merchant);
    const bucket = buckets.get(category) ?? { amounts: [], count: 0 };
    bucket.amounts.push(transaction.signedAmount);
    bucket.count += 1;
    buckets.set(category, bucket);
  }

  return [...buckets.entries()]
    .map(([category, bucket]) => ({
      category,
      total: sumMoney(bucket.amounts),
      count: bucket.count,
    }))
    .sort((left, right) => {
      const totalOrder = compareMoney(right.total, left.total);

      if (totalOrder !== 0) {
        return totalOrder;
      }

      return categoryRank(left.category) - categoryRank(right.category);
    });
}

function summarizeTrend(transactions: Transaction[]): FreeAnalysis["trend"] {
  const buckets = new Map<string, string[]>();

  for (const transaction of transactions) {
    const period = monthlyPeriod(transaction.date);

    if (period === null) {
      continue;
    }

    buckets.set(period, [
      ...(buckets.get(period) ?? []),
      transaction.signedAmount,
    ]);
  }

  return [...buckets.entries()]
    .map(([period, amounts]) => ({
      period,
      total: sumMoney(amounts),
    }))
    .sort((left, right) => left.period.localeCompare(right.period));
}

function categoryRank(category: Category): number {
  return CATEGORY_ORDER.indexOf(category);
}
