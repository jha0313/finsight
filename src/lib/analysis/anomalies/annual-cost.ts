import { formatMinorUnits, parseMinorUnits } from "@/lib/money";
import type { Anomaly } from "@/types/analysis";
import type { Transaction } from "@/types/transaction";

import { findRecurringGroups } from "./shared";

const MONTHS_PER_YEAR = BigInt("12");

// 월간 반복결제를 연 단위로 환산해 "1년이면 얼마"의 임팩트를 보여준다.
export function detectAnnualCost(transactions: Transaction[]): Anomaly[] {
  const anomalies = findRecurringGroups(transactions).map((group): Anomaly => {
    const monthly = group.representativeAmount;
    const annual = formatMinorUnits(
      parseMinorUnits(monthly) * MONTHS_PER_YEAR,
    );

    return {
      kind: "annual_cost",
      severity: "info",
      merchant: group.merchant,
      detail: `월 ${monthly} × 12 = 연 ${annual} (반복 ${group.transactions.length}회 확인)`,
      amount: annual,
      amountLabel: "연 환산",
    };
  });

  return anomalies.sort((left, right) => {
    const byAnnual = compareAnnualDesc(left, right);

    return byAnnual !== 0 ? byAnnual : left.merchant.localeCompare(right.merchant);
  });
}

function compareAnnualDesc(left: Anomaly, right: Anomaly): number {
  const leftAnnual = parseMinorUnits(left.amount ?? "0.00");
  const rightAnnual = parseMinorUnits(right.amount ?? "0.00");

  if (leftAnnual === rightAnnual) {
    return 0;
  }

  return leftAnnual > rightAnnual ? -1 : 1;
}
