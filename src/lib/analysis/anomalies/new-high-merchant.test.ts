import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectNewHighMerchants } from "./new-high-merchant";

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

// 전체 중앙값을 작은 값들로 낮게 깔아두기 위한 채움용 소액 거래.
// 서로 다른 가맹점이라 신규 고액 후보로 잡히지 않도록 임계치보다 한참 작게 둔다.
function filler(index: number): Transaction {
  return transaction({
    date: `2026-01-${String(10 + index).padStart(2, "0")}`,
    merchant: `Filler${index}`,
    signedAmount: "1000.00",
  });
}

describe("detectNewHighMerchants", () => {
  it("flags a one-off merchant charging >= overall median * 3", () => {
    // 중앙값 1000 → 임계 3000. 9000은 1회 등장 신규 고액.
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      filler(2),
      transaction({
        date: "2026-02-01",
        merchant: "  Big Shop  ",
        signedAmount: "9000.00",
      }),
    ]);

    expect(anomalies).toEqual([
      {
        kind: "new_high_merchant",
        severity: "warn",
        merchant: "Big Shop",
        amount: "9000.00",
        amountLabel: "첫 거래",
        detail: "신규 가맹점 Big Shop에서 9000.00 결제 (이력 없음)",
      },
    ]);
  });

  it("excludes merchants appearing more than once even if amount is high", () => {
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      transaction({
        date: "2026-02-01",
        merchant: "Repeat",
        signedAmount: "9000.00",
      }),
      transaction({
        date: "2026-03-01",
        merchant: "repeat.com",
        signedAmount: "9000.00",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("excludes one-off merchants below the threshold", () => {
    // 중앙값 1000 → 임계 3000. 2999는 임계 미만.
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      filler(2),
      transaction({
        date: "2026-02-01",
        merchant: "Just Under",
        signedAmount: "2999.00",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("returns an empty array for fewer than 4 transactions", () => {
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      transaction({
        date: "2026-02-01",
        merchant: "Big",
        signedAmount: "100000.00",
      }),
    ]);

    expect(anomalies).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectNewHighMerchants([])).toEqual([]);
  });

  it("excludes fixed-cost categories (utilities/finance) so recurring bills are not flagged as new", () => {
    // 공과금·보험 같은 고정비는 1회 등장 고액이라도 '신규 가맹점'이 아니다.
    // 같은 입력의 other 카테고리 고액(전자제품)만 남아야 한다.
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      filler(2),
      transaction({
        date: "2026-02-01",
        merchant: "아파트 관리비",
        signedAmount: "183000.00",
        category: "utilities",
      }),
      transaction({
        date: "2026-02-02",
        merchant: "보험료",
        signedAmount: "113000.00",
        category: "finance",
      }),
      transaction({
        date: "2026-02-03",
        merchant: "전자제품 매장",
        signedAmount: "780000.00",
        category: "other",
      }),
    ]);

    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "전자제품 매장",
    ]);
  });

  it("sorts by amount descending then merchant ascending", () => {
    // 중앙값 1000 → 임계 3000. 신규 고액 후보 3건.
    const anomalies = detectNewHighMerchants([
      filler(0),
      filler(1),
      filler(2),
      transaction({
        date: "2026-02-01",
        merchant: "Bravo",
        signedAmount: "5000.00",
      }),
      transaction({
        date: "2026-02-02",
        merchant: "Alpha",
        signedAmount: "5000.00",
      }),
      transaction({
        date: "2026-02-03",
        merchant: "Charlie",
        signedAmount: "8000.00",
      }),
    ]);

    expect(anomalies.map((anomaly) => anomaly.merchant)).toEqual([
      "Charlie",
      "Alpha",
      "Bravo",
    ]);
  });
});
