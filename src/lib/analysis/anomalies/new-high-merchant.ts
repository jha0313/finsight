import { compareMoney, formatMinorUnits, parseMinorUnits } from "@/lib/money";
import { medianMoney, merchantKey } from "@/lib/analysis/anomalies/shared";
import type { Anomaly } from "@/types/analysis";
import type { Category, Transaction } from "@/types/transaction";

const MINIMUM_TRANSACTIONS = 4;
const THRESHOLD_MULTIPLIER = BigInt("3");

// 공과금·금융 같은 고정비는 매달 내는 정기 지출이라 '신규 가맹점 고액'의
// 의미(평소 안 하던 큰 쇼핑·구독 가입)에 맞지 않는다. 노이즈를 줄이려 제외한다.
const FIXED_COST_CATEGORIES: ReadonlySet<Category> = new Set([
  "utilities",
  "finance",
]);

// 이력 없던 신규 가맹점의 큰 결제(구독 가입·큰 쇼핑)를 잡는다.
// merchantKey 기준 1회만 등장한 가맹점의 거래가 전체 중앙값*3 이상이면 신규 고액.
export function detectNewHighMerchants(
  transactions: Transaction[],
): Anomaly[] {
  if (transactions.length < MINIMUM_TRANSACTIONS) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    const key = merchantKey(transaction.merchant);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const overallMedian = medianMoney(
    transactions.map((transaction) => transaction.signedAmount),
  );
  const threshold = formatMinorUnits(
    parseMinorUnits(overallMedian) * THRESHOLD_MULTIPLIER,
  );
  const thresholdMinorUnits = parseMinorUnits(threshold);

  const anomalies: Anomaly[] = [];

  for (const transaction of transactions) {
    if (FIXED_COST_CATEGORIES.has(transaction.category)) {
      continue;
    }

    if (counts.get(merchantKey(transaction.merchant)) !== 1) {
      continue;
    }

    if (parseMinorUnits(transaction.signedAmount) < thresholdMinorUnits) {
      continue;
    }

    const merchant = transaction.merchant.trim();
    const amount = formatMinorUnits(parseMinorUnits(transaction.signedAmount));

    anomalies.push({
      kind: "new_high_merchant",
      severity: "warn",
      merchant,
      detail: `신규 가맹점 ${merchant}에서 ${amount} 결제 (이력 없음)`,
      amount,
      amountLabel: "첫 거래",
    });
  }

  return anomalies.sort((left, right) => {
    const amountOrder = compareMoney(
      right.amount ?? "0.00",
      left.amount ?? "0.00",
    );

    if (amountOrder !== 0) {
      return amountOrder;
    }

    return left.merchant.localeCompare(right.merchant);
  });
}
