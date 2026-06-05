import { formatCategory } from "@/lib/format";
import { compareMoney, formatMinorUnits, parseMinorUnits } from "@/lib/money";
import { medianMoney } from "@/lib/analysis/anomalies/shared";
import type { Anomaly } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

const MIN_CATEGORY_TRANSACTIONS = 4;
const OUTLIER_MULTIPLIER = BigInt("3");

interface OutlierEntry {
  anomaly: Anomaly;
  date: string;
}

// "같은 카테고리 평소 대비" 이례적으로 큰 거래(평소 5천원 카페의 5만원)를 잡는다.
// 카테고리별 중앙값의 3배를 초과하는 거래만 outlier로 표시한다.
export function detectCategoryOutliers(
  transactions: Transaction[],
): Anomaly[] {
  const byCategory = new Map<Category, Transaction[]>();

  for (const transaction of transactions) {
    byCategory.set(transaction.category, [
      ...(byCategory.get(transaction.category) ?? []),
      transaction,
    ]);
  }

  const entries: OutlierEntry[] = [];

  for (const [category, group] of byCategory) {
    if (group.length < MIN_CATEGORY_TRANSACTIONS) {
      continue;
    }

    const median = medianMoney(
      group.map((transaction) => transaction.signedAmount),
    );
    const threshold = formatMinorUnits(
      parseMinorUnits(median) * OUTLIER_MULTIPLIER,
    );

    for (const transaction of group) {
      if (compareMoney(transaction.signedAmount, threshold) !== 1) {
        continue;
      }

      entries.push({
        anomaly: {
          kind: "category_outlier",
          severity: "warn",
          merchant: transaction.merchant,
          detail: `${formatCategory(category)} 평소 ${median} 대비 큰 ${transaction.signedAmount}`,
          amount: transaction.signedAmount,
          amountLabel: "이상 금액",
        },
        date: transaction.date,
      });
    }
  }

  return entries.sort(compareEntries).map((entry) => entry.anomaly);
}

// amount 내림차순 → date 오름차순 → merchant 오름차순으로 결정론적 정렬.
function compareEntries(left: OutlierEntry, right: OutlierEntry): number {
  const byAmount = compareMoney(
    right.anomaly.amount ?? "0.00",
    left.anomaly.amount ?? "0.00",
  );

  if (byAmount !== 0) {
    return byAmount;
  }

  const byDate = left.date.localeCompare(right.date);

  if (byDate !== 0) {
    return byDate;
  }

  return left.anomaly.merchant < right.anomaly.merchant
    ? -1
    : left.anomaly.merchant > right.anomaly.merchant
      ? 1
      : 0;
}
