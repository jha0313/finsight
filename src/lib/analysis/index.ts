import type { Anomaly, FreeAnalysis } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

import { compareMoney, sumMoney } from "@/lib/money";

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

type DatedTransaction = Transaction & {
  parsedDate: {
    day: number;
    monthIndex: number;
  };
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
  const debitTransactions = transactions.filter(isDebitSpend);

  return {
    byCategory: summarizeByCategory(debitTransactions),
    trend: summarizeTrend(debitTransactions),
    anomalies: [
      ...detectSubscriptionLeaks(debitTransactions),
      ...detectOutliers(debitTransactions),
    ],
  };
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

function detectSubscriptionLeaks(transactions: Transaction[]): Anomaly[] {
  const groups = new Map<string, DatedTransaction[]>();

  for (const transaction of transactions) {
    const parsedDate = parseDate(transaction.date);

    if (parsedDate === null) {
      continue;
    }

    const key = merchantKey(transaction.merchant);

    groups.set(key, [
      ...(groups.get(key) ?? []),
      {
        ...transaction,
        parsedDate,
      },
    ]);
  }

  return [...groups.values()]
    .filter((group) => group.length >= 3)
    .map((group) =>
      [...group].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    )
    .filter(hasMonthlyCadence)
    .filter(hasSimilarAmounts)
    .map((group) => {
      const representativeAmount = lowerMedianMoney(
        group.map((transaction) => transaction.signedAmount),
      );
      const latest = group[group.length - 1];
      const first = group[0];

      return {
        kind: "subscription_leak",
        merchant: first.merchant.trim(),
        detail: `월간 반복 결제 후보: ${group.length}회, 최근 ${latest.date}, 대표 금액 ${representativeAmount}.`,
      };
    })
    .sort((left, right) => {
      const merchantOrder = left.merchant.localeCompare(right.merchant);

      if (merchantOrder !== 0) {
        return merchantOrder;
      }

      return left.detail.localeCompare(right.detail);
    });
}

function detectOutliers(transactions: Transaction[]): Anomaly[] {
  if (transactions.length < 4) {
    return [];
  }

  const median = lowerMedianMoney(
    transactions.map((transaction) => transaction.signedAmount),
  );
  const threshold = formatMinorUnits(toMinorUnits(median) * BigInt("3"));

  return [...transactions]
    .sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date);

      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.merchant.localeCompare(right.merchant);
    })
    .filter(
      (transaction) =>
        compareMoney(transaction.signedAmount, threshold) === 1,
    )
    .map((transaction) => ({
      kind: "outlier",
      merchant: transaction.merchant.trim(),
      detail: `평소 지출 중앙값 ${median} 대비 큰 금액 ${transaction.signedAmount}.`,
    }));
}

function isDebitSpend(transaction: Transaction): boolean {
  return (
    transaction.direction === "debit" &&
    compareMoney(transaction.signedAmount, "0.00") === 1
  );
}

function normalizeMerchant(merchant: string): string {
  return merchant.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function merchantKey(merchant: string): string {
  const tokens = normalizeMerchant(merchant)
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(" ")
    .filter((token) => token !== "" && !isMerchantNoiseToken(token));

  return tokens[0] ?? normalizeMerchant(merchant);
}

function isMerchantNoiseToken(token: string): boolean {
  return ["com", "co", "kr", "inc", "ltd", "주식회사"].includes(token);
}

function monthlyPeriod(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);

  if (match === null) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

function parseDate(
  date: string,
): DatedTransaction["parsedDate"] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return {
    day,
    monthIndex: year * 12 + month,
  };
}

function hasMonthlyCadence(group: DatedTransaction[]): boolean {
  return group.every((transaction, index) => {
    if (index === 0) {
      return true;
    }

    const previous = group[index - 1];
    const monthGap =
      transaction.parsedDate.monthIndex - previous.parsedDate.monthIndex;
    const dayGap = Math.abs(
      transaction.parsedDate.day - previous.parsedDate.day,
    );

    return monthGap === 1 && dayGap <= 7;
  });
}

function hasSimilarAmounts(group: DatedTransaction[]): boolean {
  const amounts = group.map((transaction) => transaction.signedAmount);
  const median = toMinorUnits(lowerMedianMoney(amounts));
  const sorted = [...amounts].sort(compareMoney);
  const spread =
    toMinorUnits(sorted[sorted.length - 1]) - toMinorUnits(sorted[0]);
  const tolerance = median / BigInt("10");

  return spread <= tolerance;
}

function lowerMedianMoney(amounts: string[]): string {
  const sorted = [...amounts].sort(compareMoney);
  const medianIndex = Math.floor((sorted.length - 1) / 2);

  return sumMoney([sorted[medianIndex]]);
}

function categoryRank(category: Category): number {
  return CATEGORY_ORDER.indexOf(category);
}

function toMinorUnits(value: string): bigint {
  const normalized = sumMoney([value]);
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(normalized);

  if (match === null) {
    throw new Error(`Invalid normalized money amount: ${value}`);
  }

  const sign = match[1] === "-" ? BigInt("-1") : BigInt("1");
  const whole = BigInt(match[2]);
  const cents = BigInt(match[3]);

  return sign * (whole * BigInt("100") + cents);
}

function formatMinorUnits(minorUnits: bigint): string {
  if (minorUnits === BigInt("0")) {
    return "0.00";
  }

  const sign = minorUnits < BigInt("0") ? "-" : "";
  const absolute = minorUnits < BigInt("0") ? -minorUnits : minorUnits;
  const whole = absolute / BigInt("100");
  const cents = absolute % BigInt("100");
  const centsText = cents < BigInt("10") ? `0${cents}` : `${cents}`;

  return `${sign}${whole}.${centsText}`;
}
