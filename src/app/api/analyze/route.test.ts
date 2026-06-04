import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST, maxDuration } from "./route";

const analyzeRouteMocks = vi.hoisted(() => {
  const createAiUsage = vi.fn();
  const createClaudeInsightProvider = vi.fn();
  const createStatementRepository = vi.fn();
  const createSubscriptionGateway = vi.fn();
  const getCurrentUser = vi.fn();
  const runAnalyzeRequest = vi.fn();

  return {
    createAiUsage,
    createClaudeInsightProvider,
    createStatementRepository,
    createSubscriptionGateway,
    getCurrentUser,
    runAnalyzeRequest,
  };
});

vi.mock("@/lib/orchestration", () => ({
  runAnalyzeRequest: analyzeRouteMocks.runAnalyzeRequest,
}));

vi.mock("@/services/claude", () => ({
  createClaudeInsightProvider: analyzeRouteMocks.createClaudeInsightProvider,
}));

vi.mock("@/services/supabase", () => ({
  createAiUsage: analyzeRouteMocks.createAiUsage,
  createStatementRepository: analyzeRouteMocks.createStatementRepository,
  createSubscriptionGateway: analyzeRouteMocks.createSubscriptionGateway,
  getCurrentUser: analyzeRouteMocks.getCurrentUser,
}));

const ANALYZE_RESPONSE = {
  tier: "free",
  free: {
    byCategory: [],
    trend: [],
    anomalies: [],
  },
  pro: {
    status: "locked",
  },
};

describe("analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeRouteMocks.createAiUsage.mockReturnValue({ kind: "usage" });
    analyzeRouteMocks.createClaudeInsightProvider.mockReturnValue({
      kind: "claude-provider",
    });
    analyzeRouteMocks.createStatementRepository.mockReturnValue({
      kind: "repository",
    });
    analyzeRouteMocks.createSubscriptionGateway.mockReturnValue({
      kind: "gateway",
    });
    analyzeRouteMocks.runAnalyzeRequest.mockResolvedValue({
      status: 200,
      body: ANALYZE_RESPONSE,
    });
  });

  it("raises route maxDuration for synchronous Opus analysis latency", () => {
    expect(maxDuration).toBe(60);
  });

  it("passes raw CSV body to the testable analyze handler with lazy adapters", async () => {
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: "date,merchant,amount\n2026-06-01,스타벅스,5500",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ANALYZE_RESPONSE);
    expect(analyzeRouteMocks.runAnalyzeRequest).toHaveBeenCalledTimes(1);
    const call = analyzeRouteMocks.runAnalyzeRequest.mock.calls[0][0];
    expect(call.csv).toBe(
      "date,merchant,amount\n2026-06-01,스타벅스,5500",
    );
    expect(call.deps).toMatchObject({
      getCurrentUser: analyzeRouteMocks.getCurrentUser,
      aiUsage: { kind: "usage" },
      statementRepository: { kind: "repository" },
      subscriptionGateway: { kind: "gateway" },
    });
    expect(analyzeRouteMocks.createClaudeInsightProvider).not.toHaveBeenCalled();

    expect(call.deps.insightProviderFactory()).toEqual({
      kind: "claude-provider",
    });
    expect(analyzeRouteMocks.createClaudeInsightProvider).toHaveBeenCalledTimes(
      1,
    );
  });

  it("passes multipart uploaded CSV files without reading a request tier", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["date,merchant,amount\n2026-06-01,서점,12000"], {
        type: "text/csv",
      }),
      "statement.csv",
    );
    formData.set("tier", "pro");
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: formData,
    });

    await POST(request);

    const call = analyzeRouteMocks.runAnalyzeRequest.mock.calls[0][0];
    expect(Buffer.isBuffer(call.csv)).toBe(true);
    expect(call.csv.toString("utf8")).toBe(
      "date,merchant,amount\n2026-06-01,서점,12000",
    );
    expect(call).not.toHaveProperty("tier");
  });
});
