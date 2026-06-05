import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import type { Anomaly } from "@/types/analysis";

import { analyze, categorize, sortAnomalies } from "./index";

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

  it("composes detector outputs into a deterministically sorted anomalies array", () => {
    const result = analyze([
      transaction({
        date: "2026-06-01",
        merchant: "편의점",
        signedAmount: "10000.00",
      }),
      transaction({
        date: "2026-06-04",
        merchant: "전자제품 매장",
        signedAmount: "150000.00",
      }),
    ]);

    // 8개 detector는 현재 스텁이라 빈 배열을 합쳐 정렬한 결과도 비어 있다.
    expect(result.anomalies).toEqual([]);
  });
});

describe("sortAnomalies", () => {
  it("orders by severity, then kind, then merchant, then detail", () => {
    const anomalies: Anomaly[] = [
      {
        kind: "category_surge",
        severity: "info",
        merchant: "Zeta",
        detail: "a",
      },
      {
        kind: "price_hike",
        severity: "high",
        merchant: "Beta",
        detail: "b",
      },
      {
        kind: "annual_cost",
        severity: "high",
        merchant: "Alpha",
        detail: "a",
      },
      {
        kind: "annual_cost",
        severity: "high",
        merchant: "Alpha",
        detail: "b",
      },
      {
        kind: "annual_cost",
        severity: "warn",
        merchant: "Alpha",
        detail: "a",
      },
    ];

    expect(
      sortAnomalies(anomalies).map((anomaly) => [
        anomaly.severity,
        anomaly.kind,
        anomaly.merchant,
        anomaly.detail,
      ]),
    ).toEqual([
      ["high", "annual_cost", "Alpha", "a"],
      ["high", "annual_cost", "Alpha", "b"],
      ["high", "price_hike", "Beta", "b"],
      ["warn", "annual_cost", "Alpha", "a"],
      ["info", "category_surge", "Zeta", "a"],
    ]);
  });
});
