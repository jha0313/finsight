import { describe, expect, it, vi } from "vitest";

import { parseCsvStatement } from "@/lib/csv";
import type { ProInsights } from "@/types/analysis";
import type {
  AiUsageGateway,
  AnalyticsPort,
  CheckoutGateway,
  InsightProvider,
  LatestStatement,
  SubscriptionUpsertPayload,
  StatementRepository,
  SubscriptionGateway,
  WebhookEvent,
  WebhookSubscriptionRepository,
} from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

import type { OncallAlert } from "@/types/ports";

import {
  runAnalysis,
  runAnalyzeRequest,
  runCheckoutRequest,
  runLatestAnalysisRequest,
  runPolarWebhookRequest,
  runPostHogWebhookRequest,
  runSubscriptionCancelRequest,
  type PostHogWebhookRequestDeps,
} from "./index";

const STANDARD_CSV = `date,merchant,amount,currency,account
2026-06-01,스타벅스,5500,KRW,1234-5678-9012-3456
2026-06-02,지하철,1500,KRW,1234-5678-9012-3456
2026-06-03,월급,-3000000,KRW,1234-5678-9012-3456`;

// 결제 복귀 자동 재분석은 원본 CSV가 아니라 DB에 저장된 정규화 거래
// (Transaction[])를 입력으로 쓴다. STANDARD_CSV의 지출 2건과 동치.
const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    date: "2026-06-01",
    merchant: "스타벅스",
    signedAmount: "5500.00",
    direction: "debit",
    category: "food",
    currency: "KRW",
    maskedAccount: "**** **** **** 3456",
    rowHash: "a".repeat(64),
  },
  {
    date: "2026-06-02",
    merchant: "지하철",
    signedAmount: "1500.00",
    direction: "debit",
    category: "transport",
    currency: "KRW",
    rowHash: "b".repeat(64),
  },
];

const LATEST_STATEMENT: LatestStatement = {
  sourceHash: "c".repeat(64),
  transactions: SAMPLE_TRANSACTIONS,
};

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

class FakeAnalytics implements AnalyticsPort {
  events: Array<{
    distinctId: string;
    event: string;
    properties?: Record<string, string | number | boolean | undefined>;
  }> = [];
  flushCount = 0;

  capture(input: {
    distinctId: string;
    event: string;
    properties?: Record<string, string | number | boolean | undefined>;
  }): void {
    this.events.push(input);
  }

  async flush(): Promise<void> {
    this.flushCount += 1;
  }

  eventsNamed(name: string): Array<{
    distinctId: string;
    event: string;
    properties?: Record<string, string | number | boolean | undefined>;
  }> {
    return this.events.filter((entry) => entry.event === name);
  }
}

function createAnalyzeRequestDeps(input: {
  userId?: string | null;
  tier?: Tier;
  quotaOk?: boolean;
  cachedInsights?: unknown | null;
  insightProvider?: InsightProvider;
  latestStatement?: LatestStatement | null;
}) {
  const statementRepository: StatementRepository & {
    calls: Parameters<StatementRepository["saveStatementAnalysis"]>[0][];
    loadCalls: string[];
  } = {
    calls: [],
    loadCalls: [],
    async saveStatementAnalysis(saveInput) {
      this.calls.push(saveInput);

      return { statementId: "statement-1" };
    },
    async loadLatestStatement(userId) {
      this.loadCalls.push(userId);

      return input.latestStatement ?? null;
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
  const analytics = new FakeAnalytics();

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
      analytics,
    },
    aiUsage,
    insightProvider,
    statementRepository,
    subscriptionGateway,
    analytics,
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
  const analytics = new FakeAnalytics();

  return {
    repository,
    upsertCalls,
    verifyCalls,
    analytics,
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
      analytics,
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

  it("reports diagnostics (aiStatus ok, cacheHit false, transactionCount)", async () => {
    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "pro",
      deps: {
        insightProvider: new FakeInsightProvider(() => ({
          summary: "심층",
          insights: ["a"],
        })),
      },
    });

    expect(result.aiStatus).toBe("ok");
    expect(result.cacheHit).toBe(false);
    // STANDARD_CSV는 지출 2건 + 월급(credit) 1건 = 3건 모두 거래로 센다.
    expect(result.transactionCount).toBe(3);
  });

  it("classifies a timeout as aiStatus 'timeout'", async () => {
    const provider = new FakeInsightProvider(
      () =>
        new Promise<ProInsights>((resolve) => {
          setTimeout(() => resolve({ summary: "late", insights: [] }), 30);
        }),
    );

    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "pro",
      deps: { insightProvider: provider, aiTimeoutMs: 1 },
    });

    expect(result.aiStatus).toBe("timeout");
    expect(result.response.pro).toEqual({ status: "unavailable" });
  });

  it("classifies a truncated structured output as aiStatus 'truncated'", async () => {
    // services/claude가 max_tokens 잘림에서 던지는 메시지를 핑거프린트로 분류한다.
    const provider = new FakeInsightProvider(() => {
      throw new Error("Claude returned no parsed output.");
    });

    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "pro",
      deps: { insightProvider: provider },
    });

    expect(result.aiStatus).toBe("truncated");
    expect(result.response.pro).toEqual({ status: "unavailable" });
  });

  it("classifies other provider errors as aiStatus 'error'", async () => {
    const provider = new FakeInsightProvider(() => {
      throw new Error("400 temperature is not supported");
    });

    const result = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "pro",
      deps: { insightProvider: provider },
    });

    expect(result.aiStatus).toBe("error");
  });

  it("reports cached and fallback diagnostics", async () => {
    const cached = await runAnalysis({
      statement: parseCsvStatement(STANDARD_CSV),
      tier: "pro",
      deps: { cachedInsights: { summary: "c", insights: [] } },
    });
    expect(cached.aiStatus).toBe("cached");
    expect(cached.cacheHit).toBe(true);

    const fallback = await runAnalysis({
      statement: parseCsvStatement(`foo,bar
one,two`),
      tier: "free",
      deps: {
        insightProvider: new FakeInsightProvider(() => ({
          summary: "x",
          insights: [],
        })),
      },
    });
    expect(fallback.aiStatus).toBe("skipped");
    expect(fallback.needsFallback).toBe(true);
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

  it("emits analysis_completed (upload) with non-PII diagnostics", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({ tier: "pro" });

    await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    const completed = analytics.eventsNamed("analysis_completed");
    expect(completed).toHaveLength(1);
    expect(completed[0].distinctId).toBe("user-1");
    expect(completed[0].properties).toEqual({
      tier: "pro",
      source: "upload",
      ai_status: "ok",
      cache_hit: false,
      transaction_count: 3,
      needs_fallback: false,
    });
    // 가맹점명·금액 같은 원문이 어떤 property에도 새지 않아야 한다.
    const serialized = JSON.stringify(analytics.events);
    expect(serialized).not.toContain("스타벅스");
    expect(serialized).not.toContain("5500");
  });

  it("emits quota_exhausted (upload) without an ai_insight_failed event", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      quotaOk: false,
    });

    await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    expect(analytics.eventsNamed("quota_exhausted")[0].properties).toEqual({
      tier: "pro",
      source: "upload",
    });
    expect(
      analytics.eventsNamed("analysis_completed")[0].properties?.ai_status,
    ).toBe("quota_exhausted");
    expect(analytics.eventsNamed("ai_insight_failed")).toEqual([]);
  });

  it("emits ai_insight_failed with the classified reason when Claude fails", async () => {
    const provider = new FakeInsightProvider(() => {
      throw new Error("Claude returned no parsed output.");
    });
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      insightProvider: provider,
    });

    await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    expect(analytics.eventsNamed("ai_insight_failed")[0].properties).toEqual({
      tier: "pro",
      reason: "truncated",
      source: "upload",
    });
  });

  it("emits parser_fallback when the standard parser cannot map columns", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({ tier: "free" });

    await runAnalyzeRequest({
      statement: parseCsvStatement(`foo,bar
one,two`),
      deps,
    });

    expect(analytics.eventsNamed("parser_fallback")[0].properties).toEqual({
      tier: "free",
    });
    expect(
      analytics.eventsNamed("analysis_completed")[0].properties?.needs_fallback,
    ).toBe(true);
  });

  it("does not emit any analysis event for unauthenticated users", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({ userId: null });

    await runAnalyzeRequest({ statement: parseCsvStatement(STANDARD_CSV), deps });

    expect(analytics.events).toEqual([]);
  });
});

describe("runLatestAnalysisRequest", () => {
  it("returns 401 for unauthenticated users without loading any statement", async () => {
    const { deps, statementRepository, subscriptionGateway } =
      createAnalyzeRequestDeps({ userId: null });

    const result = await runLatestAnalysisRequest({ deps });

    expect(result).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(statementRepository.loadCalls).toEqual([]);
    expect(subscriptionGateway.calls).toEqual([]);
  });

  it("returns 404 when the user has no stored statement", async () => {
    const { deps, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: null,
    });

    const result = await runLatestAnalysisRequest({ deps });

    expect(result).toEqual({ status: 404, body: { error: "no_statement" } });
    expect(statementRepository.loadCalls).toEqual(["user-1"]);
  });

  it("re-runs Opus for pro users and caches the insight via the idempotent RPC", async () => {
    const provider = new FakeInsightProvider(({ tier, transactions }) => ({
      summary: `${tier}:${transactions.length} 심층 분석`,
      insights: ["결제 후 Opus 인사이트"],
    }));
    const { deps, aiUsage, statementRepository, subscriptionGateway } =
      createAnalyzeRequestDeps({
        tier: "pro",
        latestStatement: LATEST_STATEMENT,
        insightProvider: provider,
      });

    const result = await runLatestAnalysisRequest({ deps });

    expect(result.status).toBe(200);
    expect(result.body.tier).toBe("pro");
    expect(result.body.pro).toEqual({
      status: "active",
      insights: {
        summary: "pro:2 심층 분석",
        insights: ["결제 후 Opus 인사이트"],
      },
    });
    // 저장된 거래로부터 Free 분석을 결정론적으로 재계산한다.
    expect(result.body.free.byCategory).toEqual([
      { category: "food", total: "5500.00", count: 1 },
      { category: "transport", total: "1500.00", count: 1 },
    ]);
    expect(result.body.currency).toBe("KRW");
    expect(subscriptionGateway.calls).toEqual(["user-1"]);
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(aiUsage.releaseCalls).toEqual([]);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].tier).toBe("pro");
    // 멱등 RPC로 캐시만 저장: 기존 statement source_hash 재사용 + Opus 결과.
    expect(statementRepository.calls).toHaveLength(1);
    expect(statementRepository.calls[0]).toMatchObject({
      userId: "user-1",
      statement: { sourceHash: "c".repeat(64), status: "ready" },
      analysis: {
        model: "claude-opus-4-8",
        result: {
          summary: "pro:2 심층 분석",
          insights: ["결제 후 Opus 인사이트"],
        },
      },
    });
    expect(statementRepository.calls[0].analysis?.inputHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(statementRepository.calls[0].transactions).toEqual(
      SAMPLE_TRANSACTIONS,
    );
  });

  it("leaves the upgrade CTA without running Opus when the subscription has not propagated yet (webhook race)", async () => {
    const provider = new FakeInsightProvider(() => ({
      summary: "should not run",
      insights: [],
    }));
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "free",
      latestStatement: LATEST_STATEMENT,
      insightProvider: provider,
    });

    const result = await runLatestAnalysisRequest({ deps });

    expect(result.status).toBe(200);
    expect(result.body.tier).toBe("free");
    // 아직 Pro로 안 보이면 locked(업그레이드 CTA) — 클라이언트가 잠깐 후 재시도한다.
    expect(result.body.pro).toEqual({ status: "locked" });
    expect(aiUsage.quotaCalls).toEqual([]);
    expect(provider.calls).toHaveLength(0);
    expect(statementRepository.calls).toEqual([]);
  });

  it("returns unavailable for pro users whose daily quota is exhausted", async () => {
    let insightProviderCreated = false;
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      quotaOk: false,
      latestStatement: LATEST_STATEMENT,
    });
    deps.insightProviderFactory = () => {
      insightProviderCreated = true;

      return new FakeInsightProvider(() => ({
        summary: "should not run",
        insights: [],
      }));
    };

    const result = await runLatestAnalysisRequest({ deps });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({ status: "unavailable" });
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(aiUsage.releaseCalls).toEqual([]);
    expect(insightProviderCreated).toBe(false);
    expect(statementRepository.calls).toEqual([]);
  });

  it("reuses cached insights without consuming quota or saving again", async () => {
    let insightProviderCreated = false;
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: LATEST_STATEMENT,
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

    const result = await runLatestAnalysisRequest({ deps });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({
      status: "active",
      insights: {
        summary: "캐시된 심층 분석",
        insights: ["이미 계산된 인사이트"],
      },
    });
    expect(aiUsage.quotaCalls).toEqual([]);
    expect(insightProviderCreated).toBe(false);
    // 캐시 hit이면 이미 저장돼 있으므로 재저장하지 않는다.
    expect(statementRepository.calls).toEqual([]);
  });

  it("refunds the quota and isolates as unavailable when the Opus call fails", async () => {
    const provider = new FakeInsightProvider(async () => {
      throw new Error("Claude unavailable");
    });
    const { deps, aiUsage, statementRepository } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: LATEST_STATEMENT,
      insightProvider: provider,
    });

    const result = await runLatestAnalysisRequest({ deps });

    expect(result.status).toBe(200);
    expect(result.body.pro).toEqual({ status: "unavailable" });
    expect(result.body.free.byCategory).toHaveLength(2);
    expect(aiUsage.quotaCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(aiUsage.releaseCalls).toEqual([{ userId: "user-1", tier: "pro" }]);
    expect(statementRepository.calls).toEqual([]);
  });

  it("emits analysis_completed (latest, ok) after re-running Opus", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: LATEST_STATEMENT,
    });

    await runLatestAnalysisRequest({ deps });

    const completed = analytics.eventsNamed("analysis_completed");
    expect(completed).toHaveLength(1);
    expect(completed[0].properties).toEqual({
      tier: "pro",
      source: "latest",
      ai_status: "ok",
      cache_hit: false,
      transaction_count: 2,
      needs_fallback: false,
    });
  });

  it("emits ai_insight_failed (latest) classified as error when Opus throws", async () => {
    const provider = new FakeInsightProvider(async () => {
      throw new Error("network down");
    });
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: LATEST_STATEMENT,
      insightProvider: provider,
    });

    await runLatestAnalysisRequest({ deps });

    expect(analytics.eventsNamed("ai_insight_failed")[0].properties).toEqual({
      tier: "pro",
      reason: "error",
      source: "latest",
    });
  });

  it("emits quota_exhausted (latest) when the pro quota is spent", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      quotaOk: false,
      latestStatement: LATEST_STATEMENT,
    });

    await runLatestAnalysisRequest({ deps });

    expect(analytics.eventsNamed("quota_exhausted")[0].properties).toEqual({
      tier: "pro",
      source: "latest",
    });
  });

  it("emits cached diagnostics (latest) without an AI failure event", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: LATEST_STATEMENT,
      cachedInsights: { summary: "캐시", insights: ["x"] },
    });

    await runLatestAnalysisRequest({ deps });

    expect(
      analytics.eventsNamed("analysis_completed")[0].properties?.ai_status,
    ).toBe("cached");
    expect(analytics.eventsNamed("ai_insight_failed")).toEqual([]);
  });

  it("does not emit when the user has no stored statement (404)", async () => {
    const { deps, analytics } = createAnalyzeRequestDeps({
      tier: "pro",
      latestStatement: null,
    });

    await runLatestAnalysisRequest({ deps });

    expect(analytics.events).toEqual([]);
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
    const { deps, repository, verifyCalls, analytics } = createWebhookRequestDeps({
      verifyThrows: true,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await runPolarWebhookRequest({
        rawBody: "{\"type\":\"subscription.active\"}",
        headers: {
          "webhook-id": "evt_1",
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
        deps,
      });

      expect(result).toEqual({
        status: 401,
        body: { error: "invalid_signature" },
      });
      expect(verifyCalls).toEqual([
        {
          rawBody: "{\"type\":\"subscription.active\"}",
          headers: {
            "webhook-id": "evt_1",
            "x-forwarded-for": "203.0.113.10, 10.0.0.1",
          },
        },
      ]);
      expect(repository.markCalls).toEqual([]);
      expect(repository.upsertCalls).toEqual([]);
      expect(analytics.eventsNamed("polar_webhook_invalid_signature")).toEqual([
        {
          distinctId: "polar_webhook",
          event: "polar_webhook_invalid_signature",
          properties: {
            error_name: "Error",
            reason: "signature_verification_failed",
            remote_ip: "203.0.113.10",
            webhook_id_present: true,
            webhook_timestamp_present: false,
          },
        },
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        "polar_webhook_invalid_signature",
        {
          error_name: "Error",
          reason: "signature_verification_failed",
          remote_ip: "203.0.113.10",
          webhook_id_present: true,
          webhook_timestamp_present: false,
        },
      );
    } finally {
      warnSpy.mockRestore();
    }
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

  it("emits subscription_activated for a newly processed active subscription", async () => {
    const { deps, analytics } = createWebhookRequestDeps({
      upsert: {
        userId: "user-1",
        polarSubscriptionId: "sub_1",
        status: "active",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        eventTimestamp: "2026-06-15T00:00:00.000Z",
      },
    });

    await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    const activated = analytics.eventsNamed("subscription_activated");
    expect(activated).toHaveLength(1);
    expect(activated[0].distinctId).toBe("user-1");
    expect(activated[0].properties).toEqual({ cancel_at_period_end: false });
  });

  it("does not emit subscription_activated for replayed (duplicate) events", async () => {
    const { deps, analytics } = createWebhookRequestDeps({
      eventState: "already_processed",
      upsert: {
        userId: "user-1",
        polarSubscriptionId: "sub_1",
        status: "active",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        eventTimestamp: "2026-06-15T00:00:00.000Z",
      },
    });

    await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(analytics.eventsNamed("subscription_activated")).toEqual([]);
  });

  it("does not emit subscription_activated for non-active subscription states", async () => {
    const { deps, analytics } = createWebhookRequestDeps({
      upsert: {
        userId: "user-1",
        polarSubscriptionId: "sub_1",
        status: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        eventTimestamp: null,
      },
    });

    await runPolarWebhookRequest({
      rawBody: "raw-body",
      headers: { "webhook-id": "evt_1" },
      deps,
    });

    expect(analytics.eventsNamed("subscription_activated")).toEqual([]);
  });
});

describe("runPostHogWebhookRequest", () => {
  it("returns 401 before idempotency when secret verification fails", async () => {
    const { deps, markCalls, dispatchCalls } = createPostHogWebhookRequestDeps({
      verifyThrows: true,
    });

    const result = await runPostHogWebhookRequest({
      rawBody: "{}",
      headers: { authorization: "Bearer wrong" },
      deps,
    });

    expect(result).toEqual({
      status: 401,
      body: { error: "invalid_signature" },
    });
    expect(markCalls).toEqual([]);
    expect(dispatchCalls).toEqual([]);
  });

  it("reports duplicate without dispatching a replayed alert", async () => {
    const { deps, markCalls, dispatchCalls } = createPostHogWebhookRequestDeps({
      eventState: "already_processed",
    });

    const result = await runPostHogWebhookRequest({
      rawBody: "{}",
      headers: { authorization: "Bearer s3cret" },
      deps,
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    });
    expect(markCalls).toEqual(["posthog:evt_1"]);
    // 비싼 triage 에이전트를 두 번 깨우지 않도록 중복은 dispatch하지 않는다.
    expect(dispatchCalls).toEqual([]);
  });

  it("marks the event before dispatching a new alert", async () => {
    const { deps, markCalls, dispatchCalls, order } =
      createPostHogWebhookRequestDeps({});

    const result = await runPostHogWebhookRequest({
      rawBody: "{}",
      headers: { authorization: "Bearer s3cret" },
      deps,
    });

    expect(result).toEqual({
      status: 200,
      body: { received: true },
    });
    expect(markCalls).toEqual(["posthog:evt_1"]);
    expect(dispatchCalls).toEqual([{ message: "boom" }]);
    // event_id 선삽입(멱등) → dispatch 순서.
    expect(order).toEqual(["mark", "dispatch"]);
  });
});

function createPostHogWebhookRequestDeps(input: {
  verifyThrows?: boolean;
  eventState?: "inserted" | "already_processed";
  alert?: OncallAlert;
}) {
  const markCalls: string[] = [];
  const dispatchCalls: unknown[] = [];
  const order: string[] = [];
  const alert: OncallAlert = input.alert ?? {
    eventId: "posthog:evt_1",
    payload: { message: "boom" },
  };

  const deps: PostHogWebhookRequestDeps = {
    verifyWebhook() {
      if (input.verifyThrows) {
        throw new Error("invalid PostHog webhook secret");
      }

      return alert;
    },
    eventRepository: {
      async markEventProcessed(eventId) {
        markCalls.push(eventId);
        order.push("mark");

        return input.eventState ?? "inserted";
      },
    },
    dispatch: {
      async dispatch(payload) {
        dispatchCalls.push(payload);
        order.push("dispatch");
      },
    },
  };

  return { deps, markCalls, dispatchCalls, order };
}

function createSubscriptionCancelRequestDeps(input: {
  userId?: string | null;
  tier?: Tier;
  polarSubscriptionId?: string | null;
}) {
  const cancelCalls: { subscriptionId: string; cancel: boolean }[] = [];

  return {
    cancelCalls,
    deps: {
      async getCurrentUser() {
        return input.userId === null ? null : { id: input.userId ?? "user-1" };
      },
      async getSubscription() {
        return {
          tier: input.tier ?? "pro",
          polarSubscriptionId:
            input.polarSubscriptionId === undefined
              ? "sub_1"
              : input.polarSubscriptionId,
        };
      },
      async cancelSubscription(subscriptionId: string, cancel: boolean) {
        cancelCalls.push({ subscriptionId, cancel });

        return {
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: cancel,
        };
      },
    },
  };
}

describe("runSubscriptionCancelRequest", () => {
  it("returns 401 for unauthenticated users without touching Polar", async () => {
    const { deps, cancelCalls } = createSubscriptionCancelRequestDeps({
      userId: null,
    });

    const result = await runSubscriptionCancelRequest({
      cancel: true,
      redirectUrl: "https://app.test/dashboard/settings?sub=canceled",
      deps,
    });

    expect(result).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(cancelCalls).toEqual([]);
  });

  it("returns 409 when the user has no active Pro subscription", async () => {
    const { deps, cancelCalls } = createSubscriptionCancelRequestDeps({
      tier: "free",
      polarSubscriptionId: null,
    });

    const result = await runSubscriptionCancelRequest({
      cancel: true,
      redirectUrl: "https://app.test/dashboard/settings?sub=canceled",
      deps,
    });

    expect(result).toEqual({
      status: 409,
      body: { error: "no_active_subscription" },
    });
    expect(cancelCalls).toEqual([]);
  });

  it("returns 409 when the Pro subscription has no Polar id", async () => {
    const { deps } = createSubscriptionCancelRequestDeps({
      tier: "pro",
      polarSubscriptionId: null,
    });

    const result = await runSubscriptionCancelRequest({
      cancel: true,
      redirectUrl: "https://app.test/dashboard/settings?sub=canceled",
      deps,
    });

    expect(result.status).toBe(409);
  });

  it("schedules cancellation at period end and redirects", async () => {
    const { deps, cancelCalls } = createSubscriptionCancelRequestDeps({
      userId: "user-42",
      polarSubscriptionId: "sub_42",
    });

    const result = await runSubscriptionCancelRequest({
      cancel: true,
      redirectUrl: "https://app.test/dashboard/settings?sub=canceled",
      deps,
    });

    expect(result).toEqual({
      status: 303,
      redirectUrl: "https://app.test/dashboard/settings?sub=canceled",
    });
    expect(cancelCalls).toEqual([{ subscriptionId: "sub_42", cancel: true }]);
  });

  it("resumes a scheduled cancellation when cancel is false", async () => {
    const { deps, cancelCalls } = createSubscriptionCancelRequestDeps({
      polarSubscriptionId: "sub_7",
    });

    await runSubscriptionCancelRequest({
      cancel: false,
      redirectUrl: "https://app.test/dashboard/settings?sub=resumed",
      deps,
    });

    expect(cancelCalls).toEqual([{ subscriptionId: "sub_7", cancel: false }]);
  });
});
