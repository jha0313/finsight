import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const latestRouteMocks = vi.hoisted(() => ({
  runLatestAnalysisRequest: vi.fn(),
  getCurrentUser: vi.fn(),
  createSubscriptionGateway: vi.fn(),
  createAiUsage: vi.fn(),
  createStatementRepository: vi.fn(),
  createClaudeInsightProvider: vi.fn(),
}));

vi.mock("@/lib/orchestration", () => ({
  runLatestAnalysisRequest: latestRouteMocks.runLatestAnalysisRequest,
}));

vi.mock("@/services/claude", () => ({
  createClaudeInsightProvider: latestRouteMocks.createClaudeInsightProvider,
}));

vi.mock("@/services/supabase", () => ({
  getCurrentUser: latestRouteMocks.getCurrentUser,
  createSubscriptionGateway: latestRouteMocks.createSubscriptionGateway,
  createAiUsage: latestRouteMocks.createAiUsage,
  createStatementRepository: latestRouteMocks.createStatementRepository,
}));

describe("analyze latest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestRouteMocks.createSubscriptionGateway.mockReturnValue({
      kind: "subscription-gateway",
    });
    latestRouteMocks.createAiUsage.mockReturnValue({ kind: "ai-usage" });
    latestRouteMocks.createStatementRepository.mockReturnValue({
      kind: "statement-repository",
    });
  });

  it("re-analyzes the latest statement with lazily created route adapters", async () => {
    const body = {
      tier: "pro",
      free: { byCategory: [], trend: [], anomalies: [] },
      pro: { status: "active", insights: { summary: "심층", insights: ["x"] } },
    };
    latestRouteMocks.runLatestAnalysisRequest.mockResolvedValue({
      status: 200,
      body,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(latestRouteMocks.runLatestAnalysisRequest).toHaveBeenCalledTimes(1);
    expect(latestRouteMocks.runLatestAnalysisRequest).toHaveBeenCalledWith({
      deps: {
        getCurrentUser: latestRouteMocks.getCurrentUser,
        subscriptionGateway: { kind: "subscription-gateway" },
        aiUsage: { kind: "ai-usage" },
        statementRepository: { kind: "statement-repository" },
        insightProviderFactory: latestRouteMocks.createClaudeInsightProvider,
      },
    });
  });

  it("propagates 404 when the user has no stored statement", async () => {
    latestRouteMocks.runLatestAnalysisRequest.mockResolvedValue({
      status: 404,
      body: { error: "no_statement" },
    });

    const response = await POST();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "no_statement" });
  });

  it("returns 401 JSON for unauthenticated users", async () => {
    latestRouteMocks.runLatestAnalysisRequest.mockResolvedValue({
      status: 401,
      body: { error: "unauthorized" },
    });

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("creates adapters at call time so a missing key cannot break module import", async () => {
    // POST가 인자를 받지 않으므로 클라이언트 본문/쿼리가 핸들러에 도달할 수 없다.
    expect(POST.length).toBe(0);
    latestRouteMocks.runLatestAnalysisRequest.mockResolvedValue({
      status: 200,
      body: {
        tier: "free",
        free: { byCategory: [], trend: [], anomalies: [] },
        pro: { status: "locked" },
      },
    });

    await POST();

    expect(latestRouteMocks.createStatementRepository).toHaveBeenCalledTimes(1);
    expect(latestRouteMocks.createSubscriptionGateway).toHaveBeenCalledTimes(1);
    expect(latestRouteMocks.createAiUsage).toHaveBeenCalledTimes(1);
  });
});
