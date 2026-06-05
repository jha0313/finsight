import { describe, expect, it } from "vitest";

import { parseCsvStatement } from "@/lib/csv";
import type { ProInsights } from "@/types/analysis";
import type {
  AiUsageGateway,
  CheckoutGateway,
  InsightProvider,
  SubscriptionUpsertPayload,
  StatementRepository,
  SubscriptionGateway,
  WebhookEvent,
  WebhookSubscriptionRepository,
} from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

import {
  runAnalysis,
  runAnalyzeRequest,
  runCheckoutRequest,
  runPolarWebhookRequest,
} from "./index";

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

function createAnalyzeRequestDeps(input: {
  userId?: string | null;
  tier?: Tier;
  quotaOk?: boolean;
  cachedInsights?: unknown | null;
  insightProvider?: InsightProvider;
}) {
  const statementRepository: StatementRepository & {
    calls: Parameters<StatementRepository["saveStatementAnalysis"]>[0][];
  } = {
    calls: [],
    async saveStatementAnalysis(saveInput) {
      this.calls.push(saveInput);

      return { statementId: "statement-1" };
    },
  };
  const subscriptionGateway: SubscriptionGateway & { calls: string[] } = {
    calls: [],
    async resolveTier(userId) {
      this.calls.push(userId);

      return input.tier ?? "free";
    },
  };
  const aiUsage: AiUsageGateway & {
    cacheCalls: Array<{ userId: string; inputHash: string }>;
    quotaCalls: Array<{ userId: string; tier: Tier }>;
    releaseCalls: Array<{ userId: string; tier: Tier }>;
  } = {
    cacheCalls: [],
    quotaCalls: [],
    releaseCalls: [],
    async getCachedInsights(userId, inputHash) {
      this.cacheCalls.push({ userId, inputHash });

      return input.cachedInsights ?? null;
    },
    async tryConsumeDailyQuota(userId, tier) {
      this.quotaCalls.push({ userId, tier });

      return input.quotaOk ?? true;
    },
    async releaseDailyQuota(userId, tier) {
      this.releaseCalls.push({ userId, tier });
    },
  };
  const insightProvider =
    input.insightProvider ??
    new FakeInsightProvider(() => ({
      summary: "AI 요약",
      insights: ["지출을 점검하세요."],
    }));
  const insightProviderFactory = () => insightProvider;

  return {
    deps: {
      async getCurrentUser() {
        return input.userId === null
          ? null
          : { id: input.userId ?? "user-1" };
      },
      subscriptionGateway,
      aiUsage,
      statementRepository,
      insightProviderFactory,
    },
    aiUsage,
    insightProvider,
    statementRepository,
    subscriptionGateway,
  };
}

function createCheckoutRequestDeps(input: { userId?: string | null }) {
  const checkout: CheckoutGateway & {
    calls: Parameters<CheckoutGateway["create"]>[0][];
  } = {
    calls: [],
    async create(createInput) {
      this.calls.push(createInput);

      return { url: "https://polar.sh/checkout/session-1" };
    },
  };

  return {
    deps: {
      async getCurrentUser() {
        return input.userId === null
          ? null
          : { id: input.userId ?? "user-1" };
      },
      checkout,
    },
    checkout,
  };
}

function createWebhookRequestDeps(input: {
  eventState?: "inserted" | "already_processed";
  verifyThrows?: boolean;
  upsertThrows?: boolean;
  upsert?: SubscriptionUpsertPayload | null;
}) {
  const verifiedEvent: WebhookEvent = {
    eventId: "evt_1",
    type: "subscription.active",
    data: { id: "sub_1" },
  };
  const repository: WebhookSubscriptionRepository & {
    markCalls: string[];
    upsertCalls: SubscriptionUpsertPayload[];
  } = {
    markCalls: [],
    upsertCalls: [],
    async markEventProcessed(eventId) {
      this.markCalls.push(eventId);

      return input.eventState ?? "inserted";
    },
    async upsertSubscription(upsertInput) {
      if (input.upsertThrows === true) {
        throw new Error("subscriptions upsert failed");
      }

      this.upsertCalls.push(upsertInput);
    },
  };
  const verifyCalls: Array<{
    rawBody: string;
    headers: Record<string, string>;
  }> = [];
  const upsertCalls: WebhookEvent[] = [];

  return {
    repository,
    upsertCalls,
    verifyCalls,
    deps: {
      verifyWebhook(rawBody: string, headers: Record<string, string>) {
        verifyCalls.push({ rawBody, headers });

        if (input.verifyThrows === true) {
          throw new Error("invalid signature");
        }

        return verifiedEvent;
      },
      toSubscriptionUpsert(event: WebhookEvent) {
        upsertCalls.push(event);

        return input.upsert === undefined
          ? {
              userId: "user-1",
              polarSubscriptionId: "sub_1",
              status: "active",
              currentPeriodEnd: "2026-07-01T00:00:00.000Z",
              eventTimestamp: "2026-06-15T00:00:00.000Z",
            }
          : input.upsert;
      },
      subscriptionRepository: repository,
    },
  };
}

describe("runAnalysis", () => {
  it("returns locked pro status for free tier when Sonnet insight succeeds", async () => {
    const provider = new FakeInsightProvider(({ tier, transactions }) => ({
      summary: `${tier}:${transactions.length}`,
      insights: ["무료 요약"],
    }));

    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.needsFallback).toBe(false);
    expect(result.response.tier).toBe("free");
    expect(result.response.currency).toBe("KRW");
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
      statement: parseCsvStatement(STANDARD_CSV),
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

  it("locks free tier (showing the upgrade CTA) when the provider fails, preserving free analysis", async () => {
    const provider = new FakeInsightProvider(async () => {
      throw new Error("Claude unavailable");
    });

    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "free",
      deps: { insightProvider: provider },
    });

    // 미구독(free)은 AI 인사이트가 실패해도 "locked"여서 업그레이드 CTA가 뜬다.
    // (구독 pro의 실패는 별도 테스트에서 "unavailable"로 격리된다.)
    expect(result.response.pro).toEqual({ status: "locked" });
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
      statement: parseCsvStatement(STANDARD_CSV),
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
      statement: parseCsvStatement(`foo,bar
one,two`),
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
      statement: parseCsvStatement(`date,merchant,amount
2026-06-01,소계,1000`),
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.needsFallback).toBe(false);
    expect(result.transactions).toEqual([]);
    expect(result.response.currency).toBeUndefined();
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

  it("derives the statement currency from transactions (PDF-style USD)", async () => {
    const provider = new FakeInsightProvider(() => ({
      summary: "요약",
      insights: [],
    }));

    const result = await runAnalysis({
      statement: {
        transactions: [
          {
            date: "2025-05-13",
            merchant: "NETFLIX.COM",
            signedAmount: "19.83",
            direction: "debit",
            currency: "USD",
          },
          {
            date: "2025-05-14",
            merchant: "STARBUCKS",
            signedAmount: "25.00",
            direction: "debit",
            currency: "USD",
          },
        ],
        warnings: [],
        needsFallback: false,
        sourceText: "pdf-source",
      },
      tier: "free",
      deps: { insightProvider: provider },
    });

    expect(result.response.currency).toBe("USD");
  });
});

describe("runAnalyzeRequest", () => {
  it("returns 401 for unauthenticated users before resolving subscription state", async () => {
    const { deps, statementRepository, subscriptionGateway } =
      createAnalyzeRequestDeps({
        userId: null,
      });

    const result = await runAnalyzeRequest({
      statement: parseCsvStatement(STANDARD_CSV),
      deps,
    });

    expect(result).toEqual({
      status: 401,
      body: { error: "unauthorized" },
    });
    expect(subscriptionGateway.calls).toEqual([]);
    expect(statementRepository.calls).toEqual([]);
  });

  it("resolves free tier through the subscription gateway and saves one RPC payload", async () => {
    const provider = new FakeInsightProvider(({ tier }) => ({
      summary: `${tier} 요약`,
      insights: ["무료 분석"],
    }));
    const { deps, aiUsage, statementRepository, subscriptionGateway } =
      createAnalyzeRequestDeps({
        tier: "free",
        insightProvider: provider,
      });

    const result = await runAnalyzeRequest({
      statement: parseCsvStatement(STANDARD_CSV),
      deps,
    });

    expect(result.status).toBe(200);
    expect(result.body.tier).toBe("free");
    expect(result.body.pro).toEqual({
      status: "locked",
      insights: {
        summary: "free 요약",
        insights: ["무료 분석"],
      },
    });
    expect(result.body.free.byCategory).toEqual([
      { category: "food", total: "5500.00", count: 1 },
      { category: "transport", total: "1500.00", count: 1 },
    ]);
    expect(subscriptionGateway.calls).toEqual(["user-1"]);
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "free" }]);
    expect(provider.calls).toHaveLength(1);
    expect(statementRepository.calls).toHaveLength(1);
    expect(statementRepository.calls[0]).toMatchObject({
      userId: "user-1",
      statement: {
        status: "ready",
      },
      analysis: {
        model: "claude-sonnet-4-6",
        result: {
          summary: "free 요약",
          insights: ["무료 분석"],
        },
      },
    });
    expect(statementRepository.calls[0].statement.sourceHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(statementRepository.calls[0].analysis?.inputHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("returns active pro status for DB-resolved pro users", async () => {
    const provider = new FakeInsightProvider(({ tier }) => ({
      summary: `${tier} 심층 분석`,
      insights: ["고급 절약 인사이트"],
    }));
    const { deps, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      insightProvider: provider,
    });

    const result = await runAnalyzeRequest({
      statement: parseCsvStatement(STANDARD_CSV),
      deps,
    });

    expect(result.status).toBe(200);
    expect(result.body.tier).toBe("pro");
    expect(result.body.pro).toEqual({
      status: "active",
      insights: {
        summary: "pro 심층 분석",
        insights: ["고급 절약 인사이트"],
      },
    });
    expect(statementRepository.calls[0].analysis?.model).toBe(
      "claude-opus-4-8",
    );
  });

  it("skips Claude when daily quota is exhausted while preserving free analysis", async () => {
    let insightProviderCreated = false;
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      quotaOk: false,
    });
    deps.insightProviderFactory = () => {
      insightProviderCreated = true;

      return new FakeInsightProvider(() => ({
        summary: "should not run",
        insights: [],
      }));
    };

    const result = await runAnalyzeRequest({
      statement: parseCsvStatement(STANDARD_CSV),
      deps,
    });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({ status: "unavailable" });
    expect(result.body.free.trend).toEqual([
      { period: "2026-06", total: "7000.00" },
    ]);
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(aiUsage.releaseCalls).toEqual([]);
    expect(insightProviderCreated).toBe(false);
    expect(statementRepository.calls).toHaveLength(1);
    expect(statementRepository.calls[0].analysis).toBeUndefined();
  });

  it("refunds the daily quota when the Claude call fails so retries are not penalized", async () => {
    const provider = new FakeInsightProvider(async () => {
      throw new Error("Claude unavailable");
    });
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      insightProvider: provider,
    });

    const result = await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({ status: "unavailable" });
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(aiUsage.releaseCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(statementRepository.calls[0].analysis).toBeUndefined();
  });

  it("does not refund the quota when the Claude call succeeds", async () => {
    const { deps, aiUsage } = createAnalyzeRequestDeps({ tier: "pro" });

    await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    expect(aiUsage.releaseCalls).toEqual([]);
  });

  it("uses cached insights without consuming quota or creating a Claude provider", async () => {
    let insightProviderCreated = false;
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      cachedInsights: {
        summary: "캐시된 심층 분석",
        insights: ["이미 계산된 인사이트"],
      },
    });
    deps.insightProviderFactory = () => {
      insightProviderCreated = true;

      return new FakeInsightProvider(() => ({
        summary: "should not run",
        insights: [],
      }));
    };

    const result = await runAnalyzeRequest({
      statement: parseCsvStatement(STANDARD_CSV),
      deps,
    });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({
      status: "active",
      insights: {
        summary: "캐시된 심층 분석",
        insights: ["이미 계산된 인사이트"],
      },
    });
    expect(aiUsage.cacheCalls[0]).toMatchObject({ userId: "user-1" });
    expect(aiUsage.cacheCalls[0].inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(aiUsage.quotaCalls).toEqual([]);
    expect(insightProviderCreated).toBe(false);
    expect(statementRepository.calls[0].analysis?.result).toEqual({
      summary: "캐시된 심층 분석",
      insights: ["이미 계산된 인사이트"],
    });
  });
});

describe("runCheckoutRequest", () => {
  it("returns 401 for unauthenticated users before creating checkout", async () => {
    const { deps, checkout } = createCheckoutRequestDeps({ userId: null });

    const result = await runCheckoutRequest({
      deps,
      productId: "product-1",
    });

    expect(result).toEqual({
      status: 401,
      body: { error: "unauthorized" },
    });
    expect(checkout.calls).toEqual([]);
  });

  it("creates checkout with the server session user id as customerExternalId", async () => {
    const { deps, checkout } = createCheckoutRequestDeps({ userId: "user-42" });

    const result = await runCheckoutRequest({
      deps,
      productId: "product-1",
    });

    expect(result).toEqual({
      status: 303,
      redirectUrl: "https://polar.sh/checkout/session-1",
    });
    expect(checkout.calls).toEqual([
      {
        customerExternalId: "user-42",
        productId: "product-1",
      },
    ]);
  });

  it("forwards successUrl to the checkout gateway", async () => {
    const { deps, checkout } = createCheckoutRequestDeps({ userId: "user-42" });

    await runCheckoutRequest({
      deps,
      productId: "product-1",
      successUrl: "https://app.example/dashboard",
    });

    expect(checkout.calls).toEqual([
      {
        customerExternalId: "user-42",
        productId: "product-1",
        successUrl: "https://app.example/dashboard",
      },
    ]);
  });
});

describe("runPolarWebhookRequest", () => {
  it("returns 401 before idempotency when signature verification fails", async () => {
    const { deps, repository, verifyCalls } = createWebhookRequestDeps({
      verifyThrows: true,
    });

    const result = await runPolarWebhookRequest({
      rawBody: "{\"type\":\"subscription.active\"}",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(result).toEqual({
      status: 401,
      body: { error: "invalid_signature" },
    });
    expect(verifyCalls).toEqual([
      {
        rawBody: "{\"type\":\"subscription.active\"}",
        headers: { "webhook-id": "evt_1" },
      },
    ]);
    expect(repository.markCalls).toEqual([]);
    expect(repository.upsertCalls).toEqual([]);
  });

  it("re-applies the idempotent upsert and reports duplicate for replayed events", async () => {
    const { deps, repository, upsertCalls } = createWebhookRequestDeps({
      eventState: "already_processed",
    });

    const result = await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    });
    expect(repository.markCalls).toEqual(["evt_1"]);
    expect(upsertCalls).toEqual([
      {
        eventId: "evt_1",
        type: "subscription.active",
        data: { id: "sub_1" },
      },
    ]);
    expect(repository.upsertCalls).toHaveLength(1);
  });

  it("upserts the subscription before marking the event processed", async () => {
    const { deps, repository, upsertCalls } = createWebhookRequestDeps({});

    const result = await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true },
    });
    expect(repository.markCalls).toEqual(["evt_1"]);
    expect(upsertCalls).toEqual([
      {
        eventId: "evt_1",
        type: "subscription.active",
        data: { id: "sub_1" },
      },
    ]);
    expect(repository.upsertCalls).toEqual([
      {
        userId: "user-1",
        polarSubscriptionId: "sub_1",
        status: "active",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        eventTimestamp: "2026-06-15T00:00:00.000Z",
      },
    ]);
  });

  it("does not mark the event processed when the subscription upsert fails", async () => {
    const { deps, repository } = createWebhookRequestDeps({
      upsertThrows: true,
    });

    await expect(
      runPolarWebhookRequest({
        rawBody: "raw-body",
        headers: { "webhook-id": "evt_1" },
        deps,
      }),
    ).rejects.toThrow();

    expect(repository.markCalls).toEqual([]);
  });

  it("keeps non-subscription webhook events idempotent without subscription upsert", async () => {
    const { deps, repository } = createWebhookRequestDeps({
      upsert: null,
    });

    const result = await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true },
    });
    expect(repository.markCalls).toEqual(["evt_1"]);
    expect(repository.upsertCalls).toEqual([]);
  });
});
