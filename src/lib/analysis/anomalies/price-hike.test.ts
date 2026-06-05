import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectPriceHike } from "./price-hike";

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

// 월간 cadence를 만족하면서 first→last 금액이 ratio만큼 변하는 3거래 그룹.
function recurring(
  merchant: string,
  first: string,
  middle: string,
  last: string,
): Transaction[] {
  return [
    transaction({ date: "2026-01-05", merchant, signedAmount: first }),
    transaction({ date: "2026-02-05", merchant, signedAmount: middle }),
    transaction({ date: "2026-03-05", merchant, signedAmount: last }),
  ];
}

describe("detectPriceHike", () => {
  it("returns no anomalies for empty input", () => {
    expect(detectPriceHike([])).toEqual([]);
  });

  it("flags a >=10% increase at the boundary", () => {
    // 10000 → 11000 = 정확히 10% 상승.
    const anomalies = detectPriceHike(
      recurring("Spotify", "10000.00", "10500.00", "11000.00"),
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      kind: "price_hike",
      severity: "high",
      merchant: "Spotify",
      amount: "1000.00",
      amountLabel: "인상폭",
    });
    expect(anomalies[0].detail).toBe(
      "10000.00 → 11000.00 (약 10% 인상, 2개월간)",
    );
  });

  it("ignores increases below the 10% threshold", () => {
    // 10000 → 10900 = 9% 상승 → 무시.
    expect(
      detectPriceHike(
        recurring("Notion", "10000.00", "10400.00", "10900.00"),
      ),
    ).toEqual([]);
  });

  it("ignores price decreases", () => {
    // 11000 → 10000 = 하락 → 무시.
    expect(
      detectPriceHike(
        recurring("Dropbox", "11000.00", "10500.00", "10000.00"),
      ),
    ).toEqual([]);
  });

  it("ignores flat prices", () => {
    expect(
      detectPriceHike(
        recurring("Adobe", "10000.00", "10000.00", "10000.00"),
      ),
    ).toEqual([]);
  });

  it("rounds the percentage to the nearest integer", () => {
    // 10000 → 11500 = 정확히 15% 상승.
    const anomalies = detectPriceHike(
      recurring("Figma", "10000.00", "10700.00", "11500.00"),
    );

    expect(anomalies[0].amount).toBe("1500.00");
    expect(anomalies[0].detail).toBe(
      "10000.00 → 11500.00 (약 15% 인상, 2개월간)",
    );
  });

  it("sorts multiple hikes by increase amount descending", () => {
    const anomalies = detectPriceHike([
      // Small: 10000 → 12000 (인상폭 2000).
      ...recurring("Small", "10000.00", "11000.00", "12000.00"),
      // Big: 20000 → 30000 (인상폭 10000).
      ...recurring("Big", "20000.00", "25000.00", "30000.00"),
    ]);

    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "Big",
      "Small",
    ]);
    expect(anomalies[0].amount).toBe("10000.00");
    expect(anomalies[1].amount).toBe("2000.00");
  });

  it("is deterministic across runs", () => {
    const input = [
      ...recurring("Small", "10000.00", "11000.00", "12000.00"),
      ...recurring("Big", "20000.00", "25000.00", "30000.00"),
    ];

    expect(detectPriceHike(input)).toEqual(detectPriceHike(input));
  });
});
