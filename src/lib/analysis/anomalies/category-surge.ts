import {
  compareMoney,
  formatMinorUnits,
  parseMinorUnits,
  sumMoney,
} from "@/lib/money";
import { isDebitSpend, monthlyPeriod } from "@/lib/analysis/anomalies/shared";
import type { Anomaly } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

const CATEGORY_LABELS: Record<Category, string> = {
  entertainment: "엔터테인먼트",
  finance: "금융",
  food: "식비",
  health: "건강",
  income: "수입",
  other: "기타",
  shopping: "쇼핑",
  transport: "교통",
  utilities: "공과금",
};

const TWO = BigInt("2");
const TEN = BigInt("10");

interface Surge {
  anomaly: Anomaly;
  latestSumMinor: bigint;
}

export function detectCategorySurge(transactions: Transaction[]): Anomaly[] {
  // period(YYYY-MM) → category → 지출 금액 문자열 목록.
  const byPeriod = new Map<string, Map<Category, string[]>>();

  for (const transaction of transactions) {
    if (!isDebitSpend(transaction)) {
      continue;
    }

    const period = monthlyPeriod(transaction.date);

    if (period === null) {
      continue;
    }

    const byCategory = byPeriod.get(period) ?? new Map<Category, string[]>();
    const amounts = byCategory.get(transaction.category) ?? [];

    amounts.push(transaction.signedAmount);
    byCategory.set(transaction.category, amounts);
    byPeriod.set(period, byCategory);
  }

  const periods = [...byPeriod.keys()].sort();

  if (periods.length < 2) {
    return [];
  }

  const latest = periods[periods.length - 1];
  const history = periods.slice(0, -1);
  const surges: Surge[] = [];

  for (const category of categoriesIn(byPeriod.get(latest))) {
    const latestSum = sumMoney(
      byPeriod.get(latest)?.get(category) ?? [],
    );

    // history 각 period의 해당 category 합 평균(없는 period는 0 포함).
    const histTotalMinor = history.reduce(
      (sum, period) =>
        sum + parseMinorUnits(sumMoney(byPeriod.get(period)?.get(category) ?? [])),
      BigInt("0"),
    );
    const histAvgMinor = histTotalMinor / BigInt(history.length);

    if (histAvgMinor <= BigInt("0")) {
      continue;
    }

    const latestSumMinor = parseMinorUnits(latestSum);

    if (latestSumMinor <= histAvgMinor * TWO) {
      continue;
    }

    const histAvg = formatMinorUnits(histAvgMinor);
    const ratio = formatRatio(latestSumMinor, histAvgMinor);
    const label = CATEGORY_LABELS[category];

    surges.push({
      latestSumMinor,
      anomaly: {
        kind: "category_surge",
        severity: "warn",
        merchant: `${label} (${latest})`,
        detail: `${label} ${latest} 지출 ${latestSum}, 평소 평균 ${histAvg}의 약 ${ratio}배`,
        amount: latestSum,
        amountLabel: "이번 달",
      },
    });
  }

  return surges
    .sort((left, right) =>
      compareMoney(
        formatMinorUnits(right.latestSumMinor),
        formatMinorUnits(left.latestSumMinor),
      ),
    )
    .map((surge) => surge.anomaly);
}

function categoriesIn(
  byCategory: Map<Category, string[]> | undefined,
): Category[] {
  if (byCategory === undefined) {
    return [];
  }

  // 결정론적 출력을 위해 카테고리 라벨 맵의 안정적 순서를 따른다.
  return (Object.keys(CATEGORY_LABELS) as Category[]).filter((category) =>
    byCategory.has(category),
  );
}

// latestSum / histAvg 를 소수 1자리로 반올림한 문자열("2.7")을 반환한다.
function formatRatio(latestSumMinor: bigint, histAvgMinor: bigint): string {
  const ratioTenths =
    (latestSumMinor * TEN + histAvgMinor / TWO) / histAvgMinor;
  const whole = ratioTenths / TEN;
  const tenth = ratioTenths % TEN;

  return `${whole}.${tenth}`;
}
