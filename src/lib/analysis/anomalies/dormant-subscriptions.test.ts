import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectDormantSubscriptions } from "./dormant-subscriptions";

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

// 3개월간 매월 결제 후 끊긴 구독. 데이터 최신월까지 다른 거래로 span을 확보한다.
function recurring(
  merchant: string,
  months: string[],
  amount: string,
  category: Transaction["category"] = "other",
): Transaction[] {
  return months.map((date) =>
    transaction({ date, merchant, signedAmount: amount, category }),
  );
}

describe("detectDormantSubscriptions", () => {
  it("returns no anomalies for empty input", () => {
    expect(detectDormantSubscriptions([])).toEqual([]);
  });

  it("returns no anomalies when the data span is shorter than 3 months", () => {
    // Jan~Mar: maxMonth-minMonth = 2 (< 3) → 판정 불가.
    const transactions = recurring(
      "Netflix",
      ["2026-01-05", "2026-02-05", "2026-03-05"],
      "17000.00",
      "entertainment",
    );

    expect(detectDormantSubscriptions(transactions)).toEqual([]);
  });

  it("flags a recurring subscription that stopped 2+ months before the latest data", () => {
    const transactions = [
      ...recurring(
        "Netflix",
        ["2026-01-05", "2026-02-05", "2026-03-05"],
        "17000.00",
        "entertainment",
      ),
      // 데이터 최신월을 5월로 끌어올려 Netflix gap = 5 - 3 = 2.
      transaction({
        date: "2026-05-20",
        merchant: "마트",
        signedAmount: "50000.00",
      }),
    ];

    const anomalies = detectDormantSubscriptions(transactions);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toEqual({
      kind: "dormant_subscription",
      severity: "warn",
      merchant: "Netflix",
      detail:
        "반복 결제가 2026-03-05 이후 2개월째 없음 — 해지/중단 추정, 확인 권장",
      amount: "17000.00",
      amountLabel: "월 절약 가능",
    });
  });

  it("excludes a recurring group that is still active up to the latest month", () => {
    // Jan~May 매월 결제 → lastMonth == maxMonth → gap 0 → 제외.
    const transactions = recurring(
      "Spotify",
      ["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05"],
      "11000.00",
      "entertainment",
    );

    expect(detectDormantSubscriptions(transactions)).toEqual([]);
  });

  it("sorts multiple dormant subscriptions by gap descending", () => {
    const transactions = [
      // gap = 6 - 3 = 3 (Jan~Mar, 끊김).
      ...recurring(
        "Netflix",
        ["2026-01-05", "2026-02-05", "2026-03-05"],
        "17000.00",
        "entertainment",
      ),
      // gap = 6 - 4 = 2 (Feb~Apr, 끊김).
      ...recurring(
        "Spotify",
        ["2026-02-10", "2026-03-10", "2026-04-10"],
        "11000.00",
        "entertainment",
      ),
      // 데이터 최신월을 6월로 끌어올린다.
      transaction({
        date: "2026-06-20",
        merchant: "마트",
        signedAmount: "50000.00",
      }),
    ];

    const anomalies = detectDormantSubscriptions(transactions);

    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "Netflix",
      "Spotify",
    ]);
    expect(anomalies[0].detail).toContain("3개월째 없음");
    expect(anomalies[1].detail).toContain("2개월째 없음");
  });
});
