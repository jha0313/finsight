import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";
import { parseAmount } from "@/lib/money";

describe("project setup", () => {
  it("loads core lib modules and runs representative functions end to end", () => {
    expect(parseAmount("1,234.56")).toBe("1234.56");

    const result = parseCsv(`date,merchant,amount\n2026-06-01,Cafe,1000`);

    expect(result.needsFallback).toBe(false);
    expect(result.transactions[0]).toMatchObject({
      merchant: "Cafe",
      signedAmount: "1000.00",
    });
  });
});
