import { describe, expect, it } from "vitest";

import { getSampleDemoAnalysis } from "./sample-demo";

describe("sample demo analysis", () => {
  it("runs the bundled CSV through runAnalysis with the fake insight provider", async () => {
    const result = await getSampleDemoAnalysis();
    const categories = result.response.free.byCategory.map(
      (item) => item.category,
    );

    expect(result.needsFallback).toBe(false);
    expect(result.transactions).toHaveLength(30);
    expect(result.response.tier).toBe("free");
    expect(result.response.pro.status).toBe("locked");
    expect(result.response.pro.insights?.summary).toContain("샘플 명세서");
    expect(categories).toEqual(
      expect.arrayContaining([
        "entertainment",
        "finance",
        "food",
        "health",
        "other",
        "shopping",
        "transport",
        "utilities",
      ]),
    );
    expect(result.response.free.trend).toEqual([
      { period: "2026-04", total: "372650.00" },
      { period: "2026-05", total: "402850.00" },
      { period: "2026-06", total: "1022050.00" },
    ]);
    expect(result.transactions).toContainEqual(
      expect.objectContaining({
        direction: "refund",
        maskedAccount: "**** **** **** 3456",
        merchant: "올리브영 환불",
        signedAmount: "-24000.00",
      }),
    );
  });
});
