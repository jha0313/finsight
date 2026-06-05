import { formatMinorUnits, parseMinorUnits, sumMoney } from "@/lib/money";
import { findRecurringGroups, type RecurringGroup } from "@/lib/analysis/anomalies/shared";
import type { Anomaly } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

const CATEGORY_LABELS: Record<Category, string> = {
  food: "식비",
  transport: "교통",
  shopping: "쇼핑",
  utilities: "공과금",
  entertainment: "엔터테인먼트",
  health: "건강",
  finance: "금융",
  income: "수입",
  other: "기타",
};

// 같은 카테고리에 동시 진행 중인 구독이 2개 이상이면 묶어서 경고한다.
export function detectDuplicateSubscriptions(
  transactions: Transaction[],
): Anomaly[] {
  const byCategory = new Map<Category, RecurringGroup[]>();

  for (const group of findRecurringGroups(transactions)) {
    byCategory.set(group.category, [
      ...(byCategory.get(group.category) ?? []),
      group,
    ]);
  }

  const anomalies: { monthlySum: string; anomaly: Anomaly }[] = [];

  for (const [category, groups] of byCategory) {
    if (groups.length < 2) {
      continue;
    }

    anomalies.push(buildAnomaly(category, groups));
  }

  // monthlySum 내림차순, 동률은 카테고리 라벨 오름차순으로 안정 정렬.
  return anomalies
    .sort((left, right) => {
      const bySum = compareMoneyDesc(left.monthlySum, right.monthlySum);

      if (bySum !== 0) {
        return bySum;
      }

      return left.anomaly.merchant.localeCompare(right.anomaly.merchant);
    })
    .map((entry) => entry.anomaly);
}

function buildAnomaly(
  category: Category,
  groups: RecurringGroup[],
): { monthlySum: string; anomaly: Anomaly } {
  const monthlySum = sumMoney(
    groups.map((group) => group.representativeAmount),
  );
  const annualSum = formatMinorUnits(parseMinorUnits(monthlySum) * BigInt("12"));
  const merchants = groups
    .map((group) => group.merchant)
    .sort((left, right) => left.localeCompare(right));

  return {
    monthlySum,
    anomaly: {
      kind: "duplicate_subscription",
      severity: "warn",
      merchant: `${CATEGORY_LABELS[category]} 구독 ${groups.length}개`,
      detail: `${merchants.join(", ")} 동시 구독 — 합산 월 ${monthlySum}, 연 ${annualSum}`,
      amount: annualSum,
      amountLabel: "합산 연",
    },
  };
}

function compareMoneyDesc(a: string, b: string): number {
  const left = parseMinorUnits(a);
  const right = parseMinorUnits(b);

  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
}
