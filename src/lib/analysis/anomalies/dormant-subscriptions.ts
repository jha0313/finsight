import type { Anomaly } from "@/types/analysis";
import type { Transaction } from "@/types/transaction";

import { findRecurringGroups, withParsedDate } from "@/lib/analysis/anomalies/shared";

const MIN_SPAN_MONTHS = 3;
const MIN_DORMANT_GAP_MONTHS = 2;

// 규칙적이던 반복결제가 최근 끊긴(해지/일시중단 추정) 구독을 표시한다.
export function detectDormantSubscriptions(
  transactions: Transaction[],
): Anomaly[] {
  const dated = withParsedDate(transactions);

  if (dated.length === 0) {
    return [];
  }

  const months = dated.map((transaction) => transaction.parsedDate.monthIndex);
  const maxMonth = Math.max(...months);
  const minMonth = Math.min(...months);

  // 데이터가 짧아(span < 3개월) 휴면 여부를 신뢰성 있게 판정할 수 없다.
  if (maxMonth - minMonth < MIN_SPAN_MONTHS) {
    return [];
  }

  const anomalies: { gap: number; anomaly: Anomaly }[] = [];

  for (const group of findRecurringGroups(transactions)) {
    const lastTransaction = group.transactions[group.transactions.length - 1];
    const gap = maxMonth - lastTransaction.parsedDate.monthIndex;

    if (gap < MIN_DORMANT_GAP_MONTHS) {
      continue;
    }

    anomalies.push({
      gap,
      anomaly: {
        kind: "dormant_subscription",
        severity: "warn",
        merchant: group.merchant,
        detail: `반복 결제가 ${lastTransaction.date} 이후 ${gap}개월째 없음 — 해지/중단 추정, 확인 권장`,
        amount: group.representativeAmount,
        amountLabel: "월 절약 가능",
      },
    });
  }

  return anomalies
    .sort((left, right) => right.gap - left.gap)
    .map((entry) => entry.anomaly);
}
