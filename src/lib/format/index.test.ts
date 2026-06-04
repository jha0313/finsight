import { describe, expect, it } from "vitest";

import type { Direction } from "@/types/transaction";

import {
  directionColorClass,
  formatCategory,
  formatDate,
  formatMoney,
  formatPercent,
} from "./index";

describe("formatMoney", () => {
  it("formats decimal strings with currency, separators, and two decimals", () => {
    expect(formatMoney("1234.5")).toBe("₩1,234.50");
    expect(formatMoney("-1234.567", "USD")).toBe("-$1,234.57");
    expect(formatMoney("1234", "EUR")).toBe("€1,234.00");
  });

  it("falls back to an uppercase currency code for unknown currencies", () => {
    expect(formatMoney("9876.5", "sgd")).toBe("SGD 9,876.50");
  });
});

describe("formatPercent", () => {
  it("formats exact decimal ratios as one-decimal percentages", () => {
    expect(formatPercent("25.00", "100.00")).toBe("25.0%");
    expect(formatPercent("1.00", "3.00")).toBe("33.3%");
  });

  it("returns zero percent when the total is zero", () => {
    expect(formatPercent("100.00", "0.00")).toBe("0.0%");
  });
});

describe("formatDate", () => {
  it("formats full ISO dates and monthly periods without timezone drift", () => {
    expect(formatDate("2026-06-03")).toBe("2026.06.03");
    expect(formatDate("2026-06")).toBe("2026.06");
  });
});

describe("directionColorClass", () => {
  it.each<[Direction, string]>([
    ["debit", "num down"],
    ["refund", "num up"],
    ["credit", "num up"],
  ])("maps %s to semantic numeric text classes", (direction, className) => {
    expect(directionColorClass(direction)).toBe(className);
  });
});

describe("formatCategory", () => {
  it("formats category codes into Korean dashboard labels", () => {
    expect(formatCategory("food")).toBe("식비");
    expect(formatCategory("transport")).toBe("교통");
    expect(formatCategory("other")).toBe("기타");
  });
});
