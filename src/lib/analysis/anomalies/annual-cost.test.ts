import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectAnnualCost } from "./annual-cost";

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

function monthlyGroup(
  merchant: string,
  amount: string,
  category: Transaction["category"] = "other",
): Transaction[] {
  return [
    transaction({ date: "2026-01-05", merchant, signedAmount: amount, category }),
    transaction({ date: "2026-02-05", merchant, signedAmount: amount, category }),
    transaction({ date: "2026-03-05", merchant, signedAmount: amount, category }),
  ];
}

describe("detectAnnualCost", () => {
  it("returns an empty array for empty input", () => {
    expect(detectAnnualCost([])).toEqual([]);
  });

  it("returns an empty array when there are no recurring groups", () => {
    expect(
      detectAnnualCost([
        transaction({
          date: "2026-01-10",
          merchant: "Once",
          signedAmount: "5000.00",
        }),
        transaction({
          date: "2026-02-15",
          merchant: "Twice",
          signedAmount: "8000.00",
        }),
      ]),
    ).toEqual([]);
  });

  it("annualizes a monthly recurring group with exact *12 arithmetic", () => {
    const anomalies = detectAnnualCost(
      monthlyGroup("Netflix", "17000.00", "entertainment"),
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toEqual({
      kind: "annual_cost",
      severity: "info",
      merchant: "Netflix",
      detail: "월 17000.00 × 12 = 연 204000.00 (반복 3회 확인)",
      amount: "204000.00",
      amountLabel: "연 환산",
    });
  });

  it("multiplies by 12 without float drift on fractional cents", () => {
    const anomalies = detectAnnualCost(monthlyGroup("Spotify", "10833.33"));

    expect(anomalies[0].amount).toBe("129999.96");
    expect(anomalies[0].detail).toBe(
      "월 10833.33 × 12 = 연 129999.96 (반복 3회 확인)",
    );
  });

  it("sorts by annual cost descending, then merchant ascending on ties", () => {
    const anomalies = detectAnnualCost([
      ...monthlyGroup("Cheap", "1000.00"),
      ...monthlyGroup("Expensive", "9000.00"),
      ...monthlyGroup("Bravo", "5000.00"),
      ...monthlyGroup("Alpha", "5000.00"),
    ]);

    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "Expensive",
      "Alpha",
      "Bravo",
      "Cheap",
    ]);
  });

  it("is deterministic: same input yields an identical array", () => {
    const input = [
      ...monthlyGroup("Netflix", "17000.00", "entertainment"),
      ...monthlyGroup("Spotify", "10000.00", "entertainment"),
    ];

    expect(detectAnnualCost(input)).toEqual(detectAnnualCost(input));
  });
});
