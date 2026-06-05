import {
  formatMinorUnits,
  parseMinorUnits,
} from "@/lib/money";
import type { Anomaly } from "@/types/analysis";
import type { Transaction } from "@/types/transaction";

import { findRecurringGroups } from "./shared";

const HIKE_THRESHOLD_NUMERATOR = BigInt("10"); // 10% = 1/10
const PERCENT = BigInt("100");
const TWO = BigInt("2");

// 구독료가 슬금슬금 오르는 price creep을 잡는다. 월간 반복 그룹에서 첫 거래
// 대비 마지막 거래가 10% 이상 오른 경우만 인상으로 본다(하락/동일은 무시).
export function detectPriceHike(transactions: Transaction[]): Anomaly[] {
  const anomalies: { increaseMinor: bigint; anomaly: Anomaly }[] = [];

  for (const group of findRecurringGroups(transactions)) {
    const first = group.transactions[0];
    const last = group.transactions[group.transactions.length - 1];
    const firstMinor = parseMinorUnits(first.signedAmount);
    const lastMinor = parseMinorUnits(last.signedAmount);
    const increaseMinor = lastMinor - firstMinor;

    // 상승만 + (last-first)/first >= 10% (== increase*10 >= first).
    if (
      increaseMinor <= BigInt("0") ||
      firstMinor <= BigInt("0") ||
      increaseMinor * HIKE_THRESHOLD_NUMERATOR < firstMinor
    ) {
      continue;
    }

    const pct = roundPercent(increaseMinor, firstMinor);
    const months =
      last.parsedDate.monthIndex - first.parsedDate.monthIndex;

    anomalies.push({
      increaseMinor,
      anomaly: {
        kind: "price_hike",
        severity: "high",
        merchant: group.merchant,
        detail: `${first.signedAmount} → ${last.signedAmount} (약 ${pct}% 인상, ${months}개월간)`,
        amount: formatMinorUnits(increaseMinor),
        amountLabel: "인상폭",
      },
    });
  }

  // 인상폭 내림차순 정렬(동률은 입력 순서 보존 → 결정론적).
  return anomalies
    .sort((left, right) =>
      right.increaseMinor === left.increaseMinor
        ? 0
        : right.increaseMinor > left.increaseMinor
          ? 1
          : -1,
    )
    .map((entry) => entry.anomaly);
}

// round((increase/base) * 100)를 bigint 정수 연산으로. half-up 반올림.
function roundPercent(increaseMinor: bigint, baseMinor: bigint): bigint {
  return (increaseMinor * PERCENT * TWO + baseMinor) / (baseMinor * TWO);
}
