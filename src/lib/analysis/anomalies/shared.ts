import {
  compareMoney,
  formatMinorUnits,
  parseMinorUnits,
} from "@/lib/money";
import type { Category, Transaction } from "@/types/transaction";

export type DatedTransaction = Transaction & {
  parsedDate: {
    day: number;
    monthIndex: number;
  };
};

export interface RecurringGroup {
  key: string;
  merchant: string;
  category: Category;
  transactions: DatedTransaction[];
  representativeAmount: string;
}

export function parseDate(
  date: string,
): DatedTransaction["parsedDate"] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return {
    day,
    monthIndex: year * 12 + month,
  };
}

export function normalizeMerchant(merchant: string): string {
  return merchant.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function merchantKey(merchant: string): string {
  const tokens = normalizeMerchant(merchant)
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(" ")
    .filter((token) => token !== "" && !isMerchantNoiseToken(token));

  return tokens[0] ?? normalizeMerchant(merchant);
}

export function monthlyPeriod(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);

  if (match === null) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

export function isDebitSpend(transaction: Transaction): boolean {
  return (
    transaction.direction === "debit" &&
    compareMoney(transaction.signedAmount, "0.00") === 1
  );
}

// lower median(짝수 길이면 아래쪽 값)을 normalized money string으로 반환.
export function medianMoney(amounts: string[]): string {
  const sorted = [...amounts].sort(compareMoney);
  const medianIndex = Math.floor((sorted.length - 1) / 2);

  return formatMinorUnits(parseMinorUnits(sorted[medianIndex]));
}

// parseDate를 적용해 파싱 불가 행을 제거하고 날짜 오름차순으로 정렬한다.
export function withParsedDate(
  transactions: Transaction[],
): DatedTransaction[] {
  const dated: DatedTransaction[] = [];

  for (const transaction of transactions) {
    const parsedDate = parseDate(transaction.date);

    if (parsedDate === null) {
      continue;
    }

    dated.push({ ...transaction, parsedDate });
  }

  return dated.sort((left, right) => left.date.localeCompare(right.date));
}

// merchantKey로 묶고 3회 이상 + 월간 cadence(연속 monthGap===1 && dayGap<=7)인
// 그룹만 남긴다. 금액 변동이 과도하면(max > min*2) 제외한다.
export function findRecurringGroups(
  transactions: Transaction[],
): RecurringGroup[] {
  const groups = new Map<string, DatedTransaction[]>();

  for (const transaction of withParsedDate(transactions)) {
    const key = merchantKey(transaction.merchant);

    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  const recurring: RecurringGroup[] = [];

  for (const [key, group] of groups) {
    if (group.length < 3) {
      continue;
    }

    if (!hasMonthlyCadence(group) || !hasStableAmounts(group)) {
      continue;
    }

    const first = group[0];

    recurring.push({
      key,
      merchant: first.merchant.trim(),
      category: first.category,
      transactions: group,
      representativeAmount: medianMoney(
        group.map((transaction) => transaction.signedAmount),
      ),
    });
  }

  return recurring;
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

function hasStableAmounts(group: DatedTransaction[]): boolean {
  const sorted = [...group.map((transaction) => transaction.signedAmount)].sort(
    compareMoney,
  );
  const min = parseMinorUnits(sorted[0]);
  const max = parseMinorUnits(sorted[sorted.length - 1]);

  return max <= min * BigInt("2");
}

function isMerchantNoiseToken(token: string): boolean {
  return ["com", "co", "kr", "inc", "ltd", "주식회사"].includes(token);
}
