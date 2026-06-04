import { describe, expect, it } from "vitest";

import type { ProInsights } from "@/types/analysis";
import type { InsightProvider } from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

import { runAnalysis } from "./index";

const STANDARD_CSV = `date,merchant,amount,currency,account
2026-06-01,스타벅스,5500,KRW,1234-5678-9012-3456
2026-06-02,지하철,1500,KRW,1234-5678-9012-3456
2026-06-03,월급,-3000000,KRW,1234-5678-9012-3456`;

class FakeInsightProvider implements InsightProvider {
  calls: Array<{ transactions: Transaction[]; tier: Tier }> = [];

  constructor(
    private readonly handler: (
      input: { transactions: Transaction[]; tier: Tier },
    ) => Promise<ProInsights> | ProInsights,
  ) {}

  async generate(input: {
    transactions: Transaction[];
    tier: Tier;
  }): Promise<ProInsights> {
    this.calls.push(input);

    return this.handler(input);
  }
}

describe("runAnalysis", () => {
  it("returns locked pro status for free tier when Sonnet insight succeeds", async () => {
    const provider = new FakeInsightProvider(({ tier, transactions }) => ({
      summary: `${tier}:${transactions.length}`,
      insights: ["무료 요약"],
    }));

    const result = await runAnalysis({
      csv: STANDARD_CSV,
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.needsFallback).toBe(false);
    expect(result.response.tier).toBe("free");
    expect(result.response.pro).toEqual({
      status: "locked",
      insights: {
        summary: "free:3",
        insights: ["무료 요약"],
      },
    });
    expect(result.response.free.byCategory).toEqual([
      { category: "food", total: "5500.00", count: 1 },
      { category: "transport", total: "1500.00", count: 1 },
    ]);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].tier).toBe("free");
    expect(provider.calls[0].transactions[0]).toMatchObject({
      merchant: "스타벅스",
      category: "food",
      maskedAccount: "**** **** **** 3456",
    });
    expect(provider.calls[0].transactions[0].rowHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(provider.calls[0].transactions[0].maskedAccount).not.toContain(
      "1234",
    );
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns active pro status for pro tier when Opus insight succeeds", async () => {
    const provider = new FakeInsightProvider(() => ({
      summary: "심층 분석",
      insights: ["고급 절약 인사이트"],
    }));

    const result = await runAnalysis({
      csv: STANDARD_CSV,
      tier: "pro",
      deps: { insightProvider: provider },
    });

    expect(result.response.pro).toEqual({
      status: "active",
      insights: {
        summary: "심층 분석",
        insights: ["고급 절약 인사이트"],
      },
    });
    expect(provider.calls[0].tier).toBe("pro");
  });

  it("isolates provider errors as unavailable while preserving free analysis", async () => {
    const provider = new FakeInsightProvider(async () => {
      throw new Error("Claude unavailable");
    });

    const result = await runAnalysis({
      csv: STANDARD_CSV,
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.response.pro).toEqual({ status: "unavailable" });
    expect(result.response.free.byCategory).toEqual([
      { category: "food", total: "5500.00", count: 1 },
      { category: "transport", total: "1500.00", count: 1 },
    ]);
  });

  it("isolates provider timeouts as unavailable while preserving free analysis", async () => {
    const provider = new FakeInsightProvider(
      () =>
        new Promise<ProInsights>((resolve) => {
          setTimeout(
            () => resolve({ summary: "too late", insights: ["late"] }),
            30,
          );
        }),
    );

    const result = await runAnalysis({
      csv: STANDARD_CSV,
      tier: "pro",
      deps: { insightProvider: provider, aiTimeoutMs: 1 },
    });

    expect(result.response.pro).toEqual({ status: "unavailable" });
    expect(result.response.free.trend).toEqual([
      { period: "2026-06", total: "7000.00" },
    ]);
  });

  it("propagates parser fallback state and warnings without calling AI", async () => {
    const provider = new FakeInsightProvider(() => ({
      summary: "should not be called",
      insights: [],
    }));

    const result = await runAnalysis({
      csv: `foo,bar
one,two`,
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.needsFallback).toBe(true);
    expect(result.transactions).toEqual([]);
    expect(result.response.free).toEqual({
      byCategory: [],
      trend: [],
      anomalies: [],
    });
    expect(result.response.pro).toEqual({ status: "unavailable" });
    expect(result.response.warnings).toContain(
      "Standard CSV mapping failed; Claude fallback mapping is required.",
    );
    expect(provider.calls).toHaveLength(0);
  });

  it("handles parseable but empty transaction input with a fake provider", async () => {
    const provider = new FakeInsightProvider(({ transactions }) => ({
      summary: `거래 ${transactions.length}건`,
      insights: [],
    }));

    const result = await runAnalysis({
      csv: `date,merchant,amount
2026-06-01,소계,1000`,
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.needsFallback).toBe(false);
    expect(result.transactions).toEqual([]);
    expect(result.response.free).toEqual({
      byCategory: [],
      trend: [],
      anomalies: [],
    });
    expect(result.response.pro).toEqual({
      status: "locked",
      insights: {
        summary: "거래 0건",
        insights: [],
      },
    });
    expect(provider.calls).toHaveLength(1);
  });
});
