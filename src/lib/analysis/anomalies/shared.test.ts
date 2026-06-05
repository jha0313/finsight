import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import {
  findRecurringGroups,
  medianMoney,
  parseDate,
} from "./shared";

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

describe("parseDate", () => {
  it("parses an ISO date into day and year*12+month index", () => {
    expect(parseDate("2026-03-15")).toEqual({ day: 15, monthIndex: 2026 * 12 + 3 });
  });

  it("returns null for malformed or out-of-range dates", () => {
    expect(parseDate("2026/03/15")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
    expect(parseDate("2026-03-32")).toBeNull();
  });
});

describe("medianMoney", () => {
  it("returns the lower median as a normalized money string", () => {
    expect(medianMoney(["3000.00", "1000.00", "2000.00"])).toBe("2000.00");
    expect(medianMoney(["4000.00", "1000.00", "3000.00", "2000.00"])).toBe(
      "2000.00",
    );
  });
});

describe("findRecurringGroups", () => {
  it("groups monthly-cadence merchants with stable amounts", () => {
    const groups = findRecurringGroups([
      transaction({
        date: "2026-01-05",
        merchant: "Netflix",
        signedAmount: "17000.00",
        category: "entertainment",
      }),
      transaction({
        date: "2026-02-05",
        merchant: "netflix.com",
        signedAmount: "17100.00",
        category: "entertainment",
      }),
      transaction({
        date: "2026-03-06",
        merchant: "NETFLIX",
        signedAmount: "17050.00",
        category: "entertainment",
      }),
      transaction({
        date: "2026-03-10",
        merchant: "마트",
        signedAmount: "50000.00",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].merchant).toBe("Netflix");
    expect(groups[0].category).toBe("entertainment");
    expect(groups[0].representativeAmount).toBe("17050.00");
    expect(groups[0].transactions).toHaveLength(3);
  });

  it("excludes groups with excessive amount variation (max > min*2)", () => {
    const groups = findRecurringGroups([
      transaction({
        date: "2026-01-05",
        merchant: "Wildcard",
        signedAmount: "1000.00",
      }),
      transaction({
        date: "2026-02-05",
        merchant: "Wildcard",
        signedAmount: "2500.00",
      }),
      transaction({
        date: "2026-03-05",
        merchant: "Wildcard",
        signedAmount: "1200.00",
      }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it("excludes merchants appearing fewer than 3 times", () => {
    const groups = findRecurringGroups([
      transaction({
        date: "2026-01-05",
        merchant: "Twice",
        signedAmount: "1000.00",
      }),
      transaction({
        date: "2026-02-05",
        merchant: "Twice",
        signedAmount: "1000.00",
      }),
    ]);

    expect(groups).toHaveLength(0);
  });
});
