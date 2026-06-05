import { describe, expect, it } from "vitest";

import type { Anomaly } from "@/types/analysis";
import type { Transaction } from "@/types/transaction";

import { detectCategorySurge } from "./category-surge";

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

describe("detectCategorySurge", () => {
  it("returns an empty array for empty input", () => {
    expect(detectCategorySurge([])).toEqual([]);
  });

  it("returns an empty array when only one period is present", () => {
    expect(
      detectCategorySurge([
        transaction({
          date: "2026-03-01",
          merchant: "A",
          signedAmount: "10000.00",
          category: "food",
        }),
        transaction({
          date: "2026-03-20",
          merchant: "B",
          signedAmount: "90000.00",
          category: "food",
        }),
      ]),
    ).toEqual([]);
  });

  it("flags a category whose latest spend exceeds 2x the historical average", () => {
    const anomalies = detectCategorySurge([
      // history: 2026-01 food = 10000, 2026-02 food = 20000 → avg 15000
      transaction({
        date: "2026-01-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-10",
        merchant: "Cafe",
        signedAmount: "20000.00",
        category: "food",
      }),
      // latest: 2026-03 food = 40000 (> 15000 * 2 = 30000)
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "40000.00",
        category: "food",
      }),
    ]);

    expect(anomalies).toHaveLength(1);

    const anomaly = anomalies[0];

    expect(anomaly.kind).toBe("category_surge");
    expect(anomaly.severity).toBe("warn");
    expect(anomaly.merchant).toBe("식비 (2026-03)");
    expect(anomaly.amount).toBe("40000.00");
    expect(anomaly.amountLabel).toBe("이번 달");
    expect(anomaly.detail).toBe(
      "식비 2026-03 지출 40000.00, 평소 평균 15000.00의 약 2.7배",
    );
  });

  it("does not flag a category exactly at the 2x boundary", () => {
    const anomalies = detectCategorySurge([
      transaction({
        date: "2026-01-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      // latest exactly 2x the average (10000) → 20000, not strictly greater
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "20000.00",
        category: "food",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("includes history periods with no spend in the category as 0 in the average", () => {
    const anomalies = detectCategorySurge([
      // 2026-01 food = 30000
      transaction({
        date: "2026-01-10",
        merchant: "Cafe",
        signedAmount: "30000.00",
        category: "food",
      }),
      // 2026-02 exists as a period but has no food spend → food counts as 0
      transaction({
        date: "2026-02-10",
        merchant: "Bus",
        signedAmount: "1000.00",
        category: "transport",
      }),
      // latest 2026-03 food = 40000; histAvg = (30000 + 0) / 2 = 15000
      // 40000 > 15000 * 2 = 30000 → surge
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "40000.00",
        category: "food",
      }),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].merchant).toBe("식비 (2026-03)");
    expect(anomalies[0].amount).toBe("40000.00");
    expect(anomalies[0].detail).toBe(
      "식비 2026-03 지출 40000.00, 평소 평균 15000.00의 약 2.7배",
    );
  });

  it("does not flag categories whose historical average is zero", () => {
    const anomalies = detectCategorySurge([
      // food only appears in the latest period → histAvg = 0 → skip
      transaction({
        date: "2026-01-10",
        merchant: "Bus",
        signedAmount: "1000.00",
        category: "transport",
      }),
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "40000.00",
        category: "food",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("sorts multiple surges by latest spend descending", () => {
    const anomalies = detectCategorySurge([
      // food history avg = 10000, latest = 50000 → surge
      transaction({
        date: "2026-01-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "50000.00",
        category: "food",
      }),
      // shopping history avg = 20000, latest = 80000 → surge (larger)
      transaction({
        date: "2026-01-12",
        merchant: "Mall",
        signedAmount: "20000.00",
        category: "shopping",
      }),
      transaction({
        date: "2026-02-12",
        merchant: "Mall",
        signedAmount: "20000.00",
        category: "shopping",
      }),
      transaction({
        date: "2026-03-12",
        merchant: "Mall",
        signedAmount: "80000.00",
        category: "shopping",
      }),
    ]);

    expect(anomalies.map((anomaly: Anomaly) => anomaly.merchant)).toEqual([
      "쇼핑 (2026-03)",
      "식비 (2026-03)",
    ]);
    expect(anomalies.map((anomaly: Anomaly) => anomaly.amount)).toEqual([
      "80000.00",
      "50000.00",
    ]);
  });

  it("ignores refunds and credits when summing category spend", () => {
    const anomalies = detectCategorySurge([
      transaction({
        date: "2026-01-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-10",
        merchant: "Cafe",
        signedAmount: "10000.00",
        category: "food",
      }),
      // a refund in the latest period must not inflate the spend total
      transaction({
        date: "2026-03-10",
        merchant: "Cafe",
        signedAmount: "40000.00",
        category: "food",
      }),
      transaction({
        date: "2026-03-15",
        merchant: "Cafe",
        signedAmount: "-100000.00",
        direction: "refund",
        category: "food",
      }),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].amount).toBe("40000.00");
  });
});
