import {
  compareMoney,
  formatMinorUnits,
  parseMinorUnits,
} from "@/lib/money";
import { merchantKey, withParsedDate } from "@/lib/analysis/anomalies/shared";
import type { DatedTransaction } from "@/lib/analysis/anomalies/shared";
import type { Anomaly } from "@/types/analysis";
import type { Transaction } from "@/types/transaction";

const MAX_GAP_DAYS = 3;

// monthIndex(=year*12+month)를 31일 근사로 일련 번호화한다. 같은 달이면
// day 차이 그대로, 인접 월 경계도 합리적 근사로 일수차를 잰다(윤년 무시).
function ordinalDay(parsedDate: DatedTransaction["parsedDate"]): number {
  return parsedDate.monthIndex * 31 + parsedDate.day;
}

export function detectDoubleCharge(transactions: Transaction[]): Anomaly[] {
  const groups = new Map<string, DatedTransaction[]>();

  for (const transaction of withParsedDate(transactions)) {
    const amount = formatMinorUnits(parseMinorUnits(transaction.signedAmount));
    const key = `${merchantKey(transaction.merchant)}|${amount}`;

    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const anomalies: Anomaly[] = [];

  for (const group of groups.values()) {
    for (const run of consecutiveRuns(group)) {
      anomalies.push(toAnomaly(run));
    }
  }

  return anomalies.sort((left, right) =>
    compareMoney(right.amount ?? "0.00", left.amount ?? "0.00"),
  );
}

// 날짜오름차순 그룹에서 인접 일수차 <= 3 인 연속 구간(2건 이상)을 끊어낸다.
function consecutiveRuns(group: DatedTransaction[]): DatedTransaction[][] {
  const runs: DatedTransaction[][] = [];
  let current: DatedTransaction[] = [];

  for (const transaction of group) {
    if (current.length === 0) {
      current = [transaction];
      continue;
    }

    const previous = current[current.length - 1];
    const gap = ordinalDay(transaction.parsedDate) - ordinalDay(previous.parsedDate);

    if (gap <= MAX_GAP_DAYS) {
      current.push(transaction);
      continue;
    }

    if (current.length >= 2) {
      runs.push(current);
    }

    current = [transaction];
  }

  if (current.length >= 2) {
    runs.push(current);
  }

  return runs;
}

function toAnomaly(run: DatedTransaction[]): Anomaly {
  const count = run.length;
  const amount = formatMinorUnits(parseMinorUnits(run[0].signedAmount));
  const refundable = formatMinorUnits(
    parseMinorUnits(amount) * BigInt(count - 1),
  );
  const first = run[0].date;
  const last = run[run.length - 1].date;

  return {
    kind: "double_charge",
    severity: "high",
    merchant: run[0].merchant.trim(),
    detail: `${first}~${last} 같은 금액 ${amount} ${count}회 중복 청구 — 환불 후보`,
    amount: refundable,
    amountLabel: "환불 후보",
  };
}
