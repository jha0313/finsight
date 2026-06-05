import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectDuplicateSubscriptions } from "./duplicate-subscriptions";

function transaction(
  overrides: Partial<Transaction> & {
    date: string;
    merchant: string;
    signedAmount: string;
  },
): Transaction {
  return {
    date: overrides.date,
    merchant: overrides.merchant,
    signedAmount: overrides.signedAmount,
    direction: overrides.direction ?? "debit",
    category: overrides.category ?? "other",
    currency: overrides.currency ?? "KRW",
    maskedAccount: overrides.maskedAccount,
    rowHash:
      overrides.rowHash ??
      `${overrides.date}-${overrides.merchant}-${overrides.signedAmount}`,
  };
}

// 한 가맹점을 월간 cadence·안정 금액으로 3개월치 반복 거래로 만든다.
function subscription(
  merchant: string,
  amount: string,
  category: Transaction["category"],
): Transaction[] {
  return ["2026-01-05", "2026-02-05", "2026-03-05"].map((date) =>
    transaction({ date, merchant, signedAmount: amount, category }),
  );
}

describe("detectDuplicateSubscriptions", () => {
  it("returns no anomalies for empty input", () => {
    expect(detectDuplicateSubscriptions([])).toEqual([]);
  });

  it("groups 2+ recurring subscriptions in one category into a single warn anomaly", () => {
    const anomalies = detectDuplicateSubscriptions([
      ...subscription("Netflix", "17000.00", "entertainment"),
      ...subscription("Disney+", "9900.00", "entertainment"),
    ]);

    expect(anomalies).toHaveLength(1);

    const [anomaly] = anomalies;
    expect(anomaly.kind).toBe("duplicate_subscription");
    expect(anomaly.severity).toBe("warn");
    expect(anomaly.merchant).toBe("엔터테인먼트 구독 2개");
    expect(anomaly.amountLabel).toBe("합산 연");
    // monthlySum = 17000 + 9900 = 26900, annualSum = 322800.
    expect(anomaly.amount).toBe("322800.00");
    expect(anomaly.detail).toBe(
      "Disney+, Netflix 동시 구독 — 합산 월 26900.00, 연 322800.00",
    );
  });

  it("ignores categories with only a single recurring subscription", () => {
    const anomalies = detectDuplicateSubscriptions([
      ...subscription("Netflix", "17000.00", "entertainment"),
      ...subscription("Disney+", "9900.00", "entertainment"),
      // 식비는 구독이 하나뿐 → 무시된다.
      ...subscription("밀키트", "30000.00", "food"),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].merchant).toBe("엔터테인먼트 구독 2개");
  });

  it("sorts merchant list ascending within a category", () => {
    const anomalies = detectDuplicateSubscriptions([
      ...subscription("Spotify", "10900.00", "entertainment"),
      ...subscription("Apple Music", "8900.00", "entertainment"),
      ...subscription("YouTube Premium", "10450.00", "entertainment"),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].merchant).toBe("엔터테인먼트 구독 3개");
    expect(anomalies[0].detail.startsWith(
      "Apple Music, Spotify, YouTube Premium 동시 구독",
    )).toBe(true);
  });

  it("emits one anomaly per qualifying category, sorted by monthly sum descending", () => {
    const anomalies = detectDuplicateSubscriptions([
      // entertainment: 17000 + 9900 = 26900/월
      ...subscription("Netflix", "17000.00", "entertainment"),
      ...subscription("Disney+", "9900.00", "entertainment"),
      // utilities: 50000 + 30000 = 80000/월 (더 큼)
      ...subscription("ClovaNote", "50000.00", "utilities"),
      ...subscription("Dropbox", "30000.00", "utilities"),
    ]);

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0].merchant).toBe("공과금 구독 2개");
    expect(anomalies[0].amount).toBe("960000.00");
    expect(anomalies[1].merchant).toBe("엔터테인먼트 구독 2개");
    expect(anomalies[1].amount).toBe("322800.00");
  });

  it("is deterministic for the same input", () => {
    const input = [
      ...subscription("Netflix", "17000.00", "entertainment"),
      ...subscription("Disney+", "9900.00", "entertainment"),
    ];

    expect(detectDuplicateSubscriptions(input)).toEqual(
      detectDuplicateSubscriptions(input),
    );
  });
});
