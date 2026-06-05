import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectDoubleCharge } from "./double-charge";

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

describe("detectDoubleCharge", () => {
  it("returns no anomalies for empty input", () => {
    expect(detectDoubleCharge([])).toEqual([]);
  });

  it("flags same merchant + same amount charged within 3 days", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-12",
        merchant: "acme store",
        signedAmount: "12000.00",
      }),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toEqual({
      kind: "double_charge",
      severity: "high",
      merchant: "Acme Store",
      detail:
        "2026-03-10~2026-03-12 같은 금액 12000.00 2회 중복 청구 — 환불 후보",
      amount: "12000.00",
      amountLabel: "환불 후보",
    });
  });

  it("does not flag charges separated by 4 or more days", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-14",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("computes refundable as amount*(count-1) for a 3x duplicate", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-11",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-13",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].amount).toBe("24000.00");
    expect(anomalies[0].detail).toBe(
      "2026-03-10~2026-03-13 같은 금액 12000.00 3회 중복 청구 — 환불 후보",
    );
  });

  it("ignores charges with different amounts", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-11",
        merchant: "Acme Store",
        signedAmount: "9000.00",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("treats an adjacent-month boundary within 3 days as duplicate", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-01-31",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-02-01",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
    ]);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].detail).toBe(
      "2026-01-31~2026-02-01 같은 금액 12000.00 2회 중복 청구 — 환불 후보",
    );
  });

  it("sorts multiple double charges by refundable descending", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Small Shop",
        signedAmount: "3000.00",
      }),
      transaction({
        date: "2026-03-11",
        merchant: "Small Shop",
        signedAmount: "3000.00",
      }),
      transaction({
        date: "2026-03-10",
        merchant: "Big Shop",
        signedAmount: "50000.00",
      }),
      transaction({
        date: "2026-03-12",
        merchant: "Big Shop",
        signedAmount: "50000.00",
      }),
    ]);

    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "Big Shop",
      "Small Shop",
    ]);
    expect(anomalies[0].amount).toBe("50000.00");
    expect(anomalies[1].amount).toBe("3000.00");
  });

  it("splits a group when a gap exceeds 3 days between runs", () => {
    const anomalies = detectDoubleCharge([
      transaction({
        date: "2026-03-10",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-12",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-20",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-03-22",
        merchant: "Acme Store",
        signedAmount: "12000.00",
      }),
    ]);

    expect(anomalies).toHaveLength(2);
    expect(anomalies.every((anomaly) => anomaly.amount === "12000.00")).toBe(
      true,
    );
    expect(anomalies.map((anomaly) => anomaly.detail)).toEqual([
      "2026-03-10~2026-03-12 같은 금액 12000.00 2회 중복 청구 — 환불 후보",
      "2026-03-20~2026-03-22 같은 금액 12000.00 2회 중복 청구 — 환불 후보",
    ]);
  });
});
