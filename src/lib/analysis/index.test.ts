import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { analyze, categorize } from "./index";

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

describe("categorize", () => {
  it("maps merchant keywords to categories", () => {
    expect(categorize("스타벅스 강남점")).toBe("food");
    expect(categorize("KORAIL train ticket")).toBe("transport");
    expect(categorize("Netflix monthly")).toBe("entertainment");
    expect(categorize("아파트 관리비")).toBe("utilities");
    expect(categorize("올리브영 쇼핑")).toBe("shopping");
    expect(categorize("서울 약국")).toBe("health");
    expect(categorize("은행 이자 수수료")).toBe("finance");
    expect(categorize("월급")).toBe("income");
  });

  it("returns other for unmatched merchants", () => {
    expect(categorize("unknown merchant")).toBe("other");
  });
});

describe("analyze", () => {
  it("returns empty deterministic sections for empty input", () => {
    expect(analyze([])).toEqual({
      byCategory: [],
      trend: [],
      anomalies: [],
    });
  });

  it("summarizes debit spending by categorized merchant using exact money arithmetic", () => {
    const result = analyze([
      transaction({
        date: "2026-06-01",
        merchant: "스타벅스",
        signedAmount: "1000.10",
      }),
      transaction({
        date: "2026-06-02",
        merchant: "Cafe Latte",
        signedAmount: "2000.20",
      }),
      transaction({
        date: "2026-06-03",
        merchant: "지하철",
        signedAmount: "1500.00",
      }),
      transaction({
        date: "2026-06-04",
        merchant: "스타벅스 환불",
        signedAmount: "-500.00",
        direction: "refund",
      }),
      transaction({
        date: "2026-06-05",
        merchant: "월급",
        signedAmount: "-3000000.00",
        direction: "credit",
      }),
    ]);

    expect(result.byCategory).toEqual([
      { category: "food", total: "3000.30", count: 2 },
      { category: "transport", total: "1500.00", count: 1 },
    ]);
  });

  it("groups debit spending into stable monthly trend points", () => {
    const result = analyze([
      transaction({
        date: "2026-07-02",
        merchant: "택시",
        signedAmount: "1000.00",
      }),
      transaction({
        date: "2026-06-20",
        merchant: "편의점",
        signedAmount: "0.10",
      }),
      transaction({
        date: "2026-06-01",
        merchant: "스타벅스",
        signedAmount: "0.20",
      }),
      transaction({
        date: "2026-07-03",
        merchant: "환불",
        signedAmount: "-300.00",
        direction: "refund",
      }),
    ]);

    expect(result.trend).toEqual([
      { period: "2026-06", total: "0.30" },
      { period: "2026-07", total: "1000.00" },
    ]);
  });

  it("detects repeated monthly similar-amount merchants as subscription leaks", () => {
    const result = analyze([
      transaction({
        date: "2026-01-05",
        merchant: "Netflix",
        signedAmount: "17000.00",
      }),
      transaction({
        date: "2026-02-05",
        merchant: "netflix.com",
        signedAmount: "17100.00",
      }),
      transaction({
        date: "2026-03-06",
        merchant: "NETFLIX",
        signedAmount: "17050.00",
      }),
      transaction({
        date: "2026-03-10",
        merchant: "마트",
        signedAmount: "50000.00",
      }),
    ]);

    expect(result.anomalies).toContainEqual({
      kind: "subscription_leak",
      merchant: "Netflix",
      detail:
        "월간 반복 결제 후보: 3회, 최근 2026-03-06, 대표 금액 17050.00.",
    });
  });

  it("detects unusually large debit transactions as outliers", () => {
    const result = analyze([
      transaction({
        date: "2026-06-01",
        merchant: "편의점",
        signedAmount: "10000.00",
      }),
      transaction({
        date: "2026-06-02",
        merchant: "카페",
        signedAmount: "12000.00",
      }),
      transaction({
        date: "2026-06-03",
        merchant: "택시",
        signedAmount: "11000.00",
      }),
      transaction({
        date: "2026-06-04",
        merchant: "전자제품 매장",
        signedAmount: "150000.00",
      }),
    ]);

    expect(result.anomalies).toContainEqual({
      kind: "outlier",
      merchant: "전자제품 매장",
      detail: "평소 지출 중앙값 11000.00 대비 큰 금액 150000.00.",
    });
  });
});
