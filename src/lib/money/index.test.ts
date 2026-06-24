import { describe, expect, it } from "vitest";

import {
  addMoney,
  compareMoney,
  deriveSignedAmount,
  negateMoney,
  parseAmount,
  sumMoney,
} from "./index";

describe("parseAmount", () => {
  it("normalizes currency symbols, commas, whitespace, and decimal places", () => {
    expect(parseAmount("₩1,234")).toBe("1234.00");
    expect(parseAmount("$ 1,234.5")).toBe("1234.50");
    expect(parseAmount("￦2,000원")).toBe("2000.00");
    expect(parseAmount("42")).toBe("42.00");
    expect(parseAmount("42.01")).toBe("42.01");
  });

  it("normalizes parentheses and leading or trailing minus signs as negative", () => {
    expect(parseAmount("(1,234.56)")).toBe("-1234.56");
    expect(parseAmount("-1,000")).toBe("-1000.00");
    expect(parseAmount("1,000-")).toBe("-1000.00");
  });

  it("returns zero for empty amount cells", () => {
    expect(parseAmount("")).toBe("0.00");
    expect(parseAmount("   ")).toBe("0.00");
  });

  it("parses European decimal-comma and dot-thousands notation", () => {
    expect(parseAmount("1.234,56")).toBe("1234.56");
    expect(parseAmount("1234,56")).toBe("1234.56");
    expect(parseAmount("€1.234,56")).toBe("1234.56");
    expect(parseAmount("1.234")).toBe("1234.00");
    expect(parseAmount("1.234.567,89")).toBe("1234567.89");
    expect(parseAmount("1.234.567")).toBe("1234567.00");
    expect(parseAmount("2.000,00")).toBe("2000.00");
  });

  it("keeps US thousands-comma and decimal-dot notation intact", () => {
    expect(parseAmount("1,234.56")).toBe("1234.56");
    expect(parseAmount("2,000,000")).toBe("2000000.00");
    expect(parseAmount("1,234")).toBe("1234.00");
  });

  it("throws on malformed amounts so callers can isolate the row", () => {
    expect(() => parseAmount("1.2.3")).toThrow();
    expect(() => parseAmount("1,2,3")).toThrow();
  });
});

describe("deriveSignedAmount", () => {
  it("treats debit column values as positive spend", () => {
    expect(deriveSignedAmount({ debit: "1,234" })).toEqual({
      signedAmount: "1234.00",
      direction: "debit",
    });
  });

  it("treats credit column values as negative inflow", () => {
    expect(deriveSignedAmount({ credit: "1,234" })).toEqual({
      signedAmount: "-1234.00",
      direction: "credit",
    });
  });

  it("nets debit and credit columns using spend-positive convention", () => {
    expect(deriveSignedAmount({ debit: "5,000", credit: "1,000" })).toEqual({
      signedAmount: "4000.00",
      direction: "debit",
    });
    expect(deriveSignedAmount({ debit: "1,000", credit: "5,000" })).toEqual({
      signedAmount: "-4000.00",
      direction: "credit",
    });
  });

  it("maps negative single amount columns to refund direction", () => {
    expect(deriveSignedAmount({ amount: "(2,500)" })).toEqual({
      signedAmount: "-2500.00",
      direction: "refund",
    });
  });

  it("classifies netted-to-zero and zero amounts as a zero-value debit", () => {
    expect(deriveSignedAmount({ debit: "1,000", credit: "1,000" })).toEqual({
      signedAmount: "0.00",
      direction: "debit",
    });
    expect(deriveSignedAmount({ amount: "0" })).toEqual({
      signedAmount: "0.00",
      direction: "debit",
    });
  });
});

describe("money arithmetic", () => {
  it("adds decimal strings without floating point drift", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(sumMoney(["0.10", "0.20", "1000.33", "-0.03"])).toBe(
      "1000.60",
    );
  });

  it("negates and compares normalized decimal strings", () => {
    expect(negateMoney("123.45")).toBe("-123.45");
    expect(negateMoney("-123.45")).toBe("123.45");
    expect(compareMoney("10.00", "9.99")).toBe(1);
    expect(compareMoney("10.00", "10")).toBe(0);
    expect(compareMoney("-1.00", "0.00")).toBe(-1);
  });
});
