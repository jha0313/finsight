import { describe, expect, it } from "vitest";

import type { ParsedTransaction } from "@/types/csv";
import { maskAccount, rowHash, scrubIdentifiers, sourceHash } from "./index";

const baseTransaction: ParsedTransaction = {
  date: "2026-06-01",
  merchant: "Starbucks Coffee",
  signedAmount: "5500.00",
  direction: "debit",
  currency: "KRW",
  account: "1234-5678-9012-3456",
};

describe("maskAccount", () => {
  it("masks card and account formats without exposing the full identifier", () => {
    const cases = [
      ["1234-5678-9012-3456", "**** **** **** 3456"],
      ["1234567890123456", "**** **** **** 3456"],
      ["110-123-456789", "**** **** 6789"],
    ] as const;

    for (const [raw, expected] of cases) {
      const masked = maskAccount(raw);

      expect(masked).toBe(expected);
      expect(masked).not.toContain(raw);
      expect(masked).not.toContain(raw.replace(/\D/g, ""));
    }
  });

  it("does not expose identifiers that are four characters or shorter", () => {
    expect(maskAccount("1234")).toBe("****");
    expect(maskAccount("")).toBe("");
  });
});

describe("scrubIdentifiers", () => {
  it("masks account and card numbers embedded in free-text fields", () => {
    expect(scrubIdentifiers("홍길동 110-123-456789 이체")).toBe(
      "홍길동 **** **** 6789 이체",
    );
    expect(scrubIdentifiers("CARD 1234-5678-9012-3456 결제")).toBe(
      "CARD **** **** **** 3456 결제",
    );
    expect(scrubIdentifiers("계좌 110 123 456789")).toBe(
      "계좌 **** **** 6789",
    );
  });

  it("keeps short numeric tokens like store codes and names intact", () => {
    expect(scrubIdentifiers("스타벅스 1234점")).toBe("스타벅스 1234점");
    expect(scrubIdentifiers("GS25 역삼점")).toBe("GS25 역삼점");
    expect(scrubIdentifiers("Amazon, Marketplace")).toBe("Amazon, Marketplace");
  });
});

describe("rowHash", () => {
  it("returns the same hash for the same transaction", () => {
    expect(rowHash(baseTransaction)).toBe(rowHash(baseTransaction));
    expect(rowHash(baseTransaction)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes formatting noise before hashing a transaction", () => {
    const formattedVariant: ParsedTransaction = {
      date: "2026-06-01",
      merchant: "  starbucks   coffee  ",
      signedAmount: "005500.0",
      direction: "debit",
      currency: "krw",
      account: "1234 5678 9012 3456",
    };

    expect(rowHash(formattedVariant)).toBe(rowHash(baseTransaction));
  });

  it("hashes the normalized raw account value, not the masked value", () => {
    const firstAccount: ParsedTransaction = {
      ...baseTransaction,
      account: "1111-2222-3333-3456",
    };
    const secondAccount: ParsedTransaction = {
      ...baseTransaction,
      account: "9999-8888-7777-3456",
    };

    expect(maskAccount(firstAccount.account ?? "")).toBe(
      maskAccount(secondAccount.account ?? ""),
    );
    expect(rowHash(firstAccount)).not.toBe(rowHash(secondAccount));
  });
});

describe("sourceHash", () => {
  it("normalizes source text line endings and outer whitespace", () => {
    expect(sourceHash("date,merchant,amount\r\n2026-06-01,Cafe,1000\n")).toBe(
      sourceHash("  date,merchant,amount\n2026-06-01,Cafe,1000  "),
    );
  });

  it("hashes a transaction set with row-level normalization", () => {
    const secondTransaction: ParsedTransaction = {
      date: "2026-06-02",
      merchant: "Bookstore",
      signedAmount: "12000.00",
      direction: "debit",
      currency: "KRW",
      account: "1234-5678-9012-3456",
    };
    const secondVariant: ParsedTransaction = {
      ...secondTransaction,
      merchant: " bookstore ",
      signedAmount: "0012000.0",
      account: "1234 5678 9012 3456",
    };

    expect(sourceHash([baseTransaction, secondTransaction])).toBe(
      sourceHash([secondVariant, baseTransaction]),
    );
  });
});
