import { createHash } from "node:crypto";

import { analyze, categorize } from "@/lib/analysis";
import { maskAccount, rowHash, sourceHash } from "@/lib/mask";
import type { AnalyzeResponse, ProInsights } from "@/types/analysis";
import type { ParsedStatement, ParsedTransaction } from "@/types/csv";
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

const DEFAULT_AI_TIMEOUT_MS = 60000;
const AI_PROMPT_VERSION = "claude-insights:v1";
const MODEL_BY_TIER: Record<Tier, string> = {
  free: "claude-sonnet-4-6",
  pro: "claude-opus-4-8",
};
type RunAnalysisResult = Awaited<ReturnType<typeof runAnalysis>>;

export interface AnalyzeDeps {
  insightProvider?: InsightProvider;
  aiTimeoutMs?: number;
  cachedInsights?: ProInsights;
  skipInsights?: boolean;
}

export interface AnalyzeRequestDeps {
  getCurrentUser: () => Promise<{ id: string } | null>;
  subscriptionGateway: SubscriptionGateway;
  aiUsage: AiUsageGateway;
  statementRepository: StatementRepository;
  insightProviderFactory: () => InsightProvider;
}

export interface CheckoutRequestDeps {
  getCurrentUser: () => Promise<{ id: string } | null>;
  checkout: CheckoutGateway;
}

export interface PolarWebhookRequestDeps {
  verifyWebhook: (
    rawBody: string,
    headers: Record<string, string>,
  ) => WebhookEvent;
  toSubscriptionUpsert: (
    event: Pick<WebhookEvent, "type" | "data">,
  ) => SubscriptionUpsertPayload | null;
  subscriptionRepository: WebhookSubscriptionRepository;
}

export async function runAnalysis(input: {
  statement: ParsedStatement;
  tier: Tier;
  deps: AnalyzeDeps;
}): Promise<{
  response: AnalyzeResponse;
  transactions: Transaction[];
  sourceHash: string;
  needsFallback: boolean;
}> {
  const statement = input.statement;
  const transactions = statement.transactions.map(toTransaction);
  const free = analyze(transactions);
  const source = sourceHash(statement.sourceText);
  const warnings =
    statement.warnings.length > 0 ? statement.warnings : undefined;
  const currency = resolveStatementCurrency(transactions);
  const response: AnalyzeResponse = {
    tier: input.tier,
    free,
    pro: {
      // 인사이트가 없을 때의 기본값: 미구독(free)은 "locked"(업그레이드 CTA),
      // 구독(pro)은 AI 실패/quota를 뜻하는 "unavailable".
      status: proStatusWithoutInsights(input.tier),
    },
    warnings,
    ...(currency !== undefined ? { currency } : {}),
  };

  if (statement.needsFallback) {
    // 파싱 폴백(컬럼 매핑 확인 필요)은 완료된 분석이 아니므로, 미구독이라도
    // 업그레이드 CTA가 아니라 unavailable로 둔다.
    response.pro = { status: "unavailable" };

    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: statement.needsFallback,
    };
  }

  if (input.deps.cachedInsights !== undefined) {
    response.pro = {
      status: proStatusForTier(input.tier),
      insights: input.deps.cachedInsights,
    };

    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: statement.needsFallback,
    };
  }

  if (
    input.deps.skipInsights === true ||
    input.deps.insightProvider === undefined
  ) {
    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: statement.needsFallback,
    };
  }

  const insights = await generateInsights({
    insightProvider: input.deps.insightProvider,
    transactions,
    tier: input.tier,
    timeoutMs: input.deps.aiTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
  });

  if (insights !== null) {
    response.pro = {
      status: proStatusForTier(input.tier),
      insights,
    };
  }

  return {
    response,
    transactions,
    sourceHash: source,
    needsFallback: statement.needsFallback,
  };
}

export async function runAnalyzeRequest(input: {
  statement: ParsedStatement;
  deps: AnalyzeRequestDeps;
}): Promise<
  | { status: 200; body: AnalyzeResponse }
  | { status: 401; body: { error: "unauthorized" } }
> {
  const user = await input.deps.getCurrentUser();

  if (user === null) {
    return {
      status: 401,
      body: { error: "unauthorized" },
    };
  }

  const tier = await input.deps.subscriptionGateway.resolveTier(user.id);
  const inputHash = analysisInputHash({
    statement: input.statement,
    tier,
  });
  const cachedInsights = toCachedInsights(
    await input.deps.aiUsage.getCachedInsights(user.id, inputHash),
  );
  const analysisResult =
    cachedInsights === null
      ? await runAnalysisWithoutCache({
          statement: input.statement,
          deps: input.deps,
          tier,
          userId: user.id,
        })
      : await runAnalysis({
          statement: input.statement,
          tier,
          deps: {
            cachedInsights,
          },
        });

  await input.deps.statementRepository.saveStatementAnalysis({
    userId: user.id,
    statement: {
      sourceHash: analysisResult.sourceHash,
      status: analysisResult.needsFallback ? "failed" : "ready",
    },
    transactions: analysisResult.transactions,
    analysis: toStoredAnalysis({
      inputHash,
      response: analysisResult.response,
      tier,
    }),
  });

  return {
    status: 200,
    body: analysisResult.response,
  };
}

export async function runCheckoutRequest(input: {
  productId?: string;
  successUrl?: string;
  deps: CheckoutRequestDeps;
}): Promise<
  | { status: 303; redirectUrl: string }
  | { status: 401; body: { error: "unauthorized" } }
> {
  const user = await input.deps.getCurrentUser();

  if (user === null) {
    return {
      status: 401,
      body: { error: "unauthorized" },
    };
  }

  const checkout = await input.deps.checkout.create({
    customerExternalId: user.id,
    productId: input.productId,
    successUrl: input.successUrl,
  });

  return {
    status: 303,
    redirectUrl: checkout.url,
  };
}

export async function runPolarWebhookRequest(input: {
  rawBody: string;
  headers: Record<string, string>;
  deps: PolarWebhookRequestDeps;
}): Promise<
  | { status: 200; body: { received: true; duplicate?: true } }
  | { status: 401; body: { error: "invalid_signature" } }
> {
  let event: WebhookEvent;

  try {
    event = input.deps.verifyWebhook(input.rawBody, input.headers);
  } catch {
    return {
      status: 401,
      body: { error: "invalid_signature" },
    };
  }

  // 구독 upsert를 먼저 수행하고, 성공한 뒤에야 event_id를 멱등 마킹한다.
  // upsert가 실패하면 마킹되지 않으므로 Polar 재전송이 실제로 재처리되어
  // 결제 이벤트가 영구 유실되지 않는다. (upsert는 onConflict로 멱등)
  const upsert = input.deps.toSubscriptionUpsert(event);

  if (upsert !== null) {
    await input.deps.subscriptionRepository.upsertSubscription(upsert);
  }

  const eventState =
    await input.deps.subscriptionRepository.markEventProcessed(event.eventId);

  if (eventState === "already_processed") {
    return {
      status: 200,
      body: { received: true, duplicate: true },
    };
  }

  return {
    status: 200,
    body: { received: true },
  };
}

async function runAnalysisWithoutCache(input: {
  statement: ParsedStatement;
  tier: Tier;
  userId: string;
  deps: AnalyzeRequestDeps;
}): Promise<RunAnalysisResult> {
  const quotaOk = await input.deps.aiUsage.tryConsumeDailyQuota(
    input.userId,
    input.tier,
  );

  if (!quotaOk) {
    return runAnalysis({
      statement: input.statement,
      tier: input.tier,
      deps: { skipInsights: true },
    });
  }

  const result = await runAnalysis({
    statement: input.statement,
    tier: input.tier,
    deps: {
      insightProvider: createLazyInsightProvider(
        input.deps.insightProviderFactory,
      ),
    },
  });

  // Claude 호출이 인사이트를 만들지 못했으면(타임아웃·에러·fallback) 소모한
  // quota를 환불해, 캐시가 비어 있는 동일 입력의 재시도가 quota를 영구
  // 소진시키지 않게 한다.
  if (result.response.pro.insights === undefined) {
    await input.deps.aiUsage.releaseDailyQuota(input.userId, input.tier);
  }

  return result;
}

function createLazyInsightProvider(
  insightProviderFactory: () => InsightProvider,
): InsightProvider {
  let provider: InsightProvider | null = null;

  return {
    generate(input) {
      provider ??= insightProviderFactory();

      return provider.generate(input);
    },
  };
}

function toStoredAnalysis(input: {
  inputHash: string;
  response: AnalyzeResponse;
  tier: Tier;
}): {
  inputHash: string;
  model: string;
  result: ProInsights;
} | undefined {
  if (input.response.pro.insights === undefined) {
    return undefined;
  }

  return {
    inputHash: input.inputHash,
    model: MODEL_BY_TIER[input.tier],
    result: input.response.pro.insights,
  };
}

function toCachedInsights(value: unknown): ProInsights | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    summary?: unknown;
    insights?: unknown;
  };

  if (
    typeof candidate.summary !== "string" ||
    !Array.isArray(candidate.insights) ||
    !candidate.insights.every((insight) => typeof insight === "string")
  ) {
    return null;
  }

  return {
    summary: candidate.summary,
    insights: candidate.insights,
  };
}

// 캐시 키는 원본 텍스트가 아니라 파싱·정규화된 '거래 단위' 입력으로 만든다
// (컬럼 순서·공백·요약행 차이는 동일 거래면 같은 키 → 불필요한 재호출 방지).
// CSV·PDF 입력 형식과도 무관하다. CLAUDE.md의 unique(user_id, input_hash)
// 캐시 규칙과 일치한다.
function analysisInputHash(input: {
  statement: ParsedStatement;
  tier: Tier;
}): string {
  const payload = JSON.stringify([
    AI_PROMPT_VERSION,
    MODEL_BY_TIER[input.tier],
    sourceHash(input.statement.transactions),
  ]);

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function proStatusForTier(tier: Tier): AnalyzeResponse["pro"]["status"] {
  return tier === "pro" ? "active" : "locked";
}

// 인사이트가 없는 경우의 pro.status. 미구독(free)은 "잠금"(업그레이드 CTA 노출),
// 구독(pro)은 AI 실패/quota 소진을 뜻하는 "unavailable".
function proStatusWithoutInsights(
  tier: Tier,
): AnalyzeResponse["pro"]["status"] {
  return tier === "pro" ? "unavailable" : "locked";
}

// 명세서는 단일 청구 통화를 가정하되, 혼합 시 최빈 통화를 대표값으로 쓴다.
// 거래가 없거나 통화를 알 수 없으면 undefined(표시부가 기본값으로 강등).
function resolveStatementCurrency(
  transactions: Transaction[],
): string | undefined {
  const counts = new Map<string, number>();

  for (const transaction of transactions) {
    const code = transaction.currency.trim().toUpperCase();

    if (code !== "") {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  let best: string | undefined;
  let bestCount = 0;

  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }

  return best;
}

function toTransaction(parsed: ParsedTransaction): Transaction {
  const transaction: Transaction = {
    date: parsed.date,
    merchant: parsed.merchant,
    signedAmount: parsed.signedAmount,
    direction: parsed.direction,
    category: categorize(parsed.merchant),
    currency: parsed.currency,
    rowHash: rowHash(parsed),
  };
  const maskedAccount =
    parsed.account === undefined ? "" : maskAccount(parsed.account);

  if (maskedAccount !== "") {
    transaction.maskedAccount = maskedAccount;
  }

  return transaction;
}

async function generateInsights(input: {
  insightProvider: InsightProvider;
  transactions: Transaction[];
  tier: Tier;
  timeoutMs: number;
}): Promise<AnalyzeResponse["pro"]["insights"] | null> {
  try {
    return await withTimeout(
      input.insightProvider.generate({
        transactions: input.transactions,
        tier: input.tier,
      }),
      input.timeoutMs,
    );
  } catch (error) {
    // 실패 원인(30s 타임아웃 vs Claude API 에러)이 묻히지 않도록 서버 로그에
    // 남긴다. 호출부는 여전히 null→pro.status=unavailable로 격리한다.
    console.error("AI insight generation failed", error);

    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("AI insight generation timed out."));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}
