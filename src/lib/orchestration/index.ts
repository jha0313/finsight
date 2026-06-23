import { createHash } from "node:crypto";

import { analyze, categorize } from "@/lib/analysis";
import { maskAccount, rowHash, sourceHash } from "@/lib/mask";
import type { AnalyzeResponse, ProInsights } from "@/types/analysis";
import type { ParsedStatement, ParsedTransaction } from "@/types/csv";
import type {
  AiUsageGateway,
  AnalyticsPort,
  CheckoutGateway,
  InsightProvider,
  OncallAlert,
  OncallDispatchGateway,
  OncallEventRepository,
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

// 분석 1건의 AI 인사이트 처리 결과(진단). 'ok'=성공, 'cached'=캐시 재사용,
// 'skipped'=AI 미호출(파싱폴백·미구독 등), 'quota_exhausted'=일일 quota 소진,
// 'timeout'/'truncated'/'error'=Claude 호출 실패(원인별 — 각각 30s 초과, 출력 잘림,
// 그 외 API 에러). PostHog 이벤트의 ai_status·ai_insight_failed reason으로 그대로 쓴다.
type AiStatus =
  | "ok"
  | "cached"
  | "skipped"
  | "quota_exhausted"
  | "timeout"
  | "truncated"
  | "error";

// generateInsights가 분류해 돌려주는 실제 Claude 호출 결과(quota·캐시·skip은 제외).
type AiOutcome =
  | { status: "ok"; insights: ProInsights }
  | { status: "timeout" }
  | { status: "truncated" }
  | { status: "error" };

// AI 인사이트가 실패로 끝났는지(원인 구분이 ai_insight_failed로 보고된다).
function isAiFailure(
  status: AiStatus,
): status is "timeout" | "truncated" | "error" {
  return status === "timeout" || status === "truncated" || status === "error";
}

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
  analytics: AnalyticsPort;
}

export interface CheckoutRequestDeps {
  getCurrentUser: () => Promise<{ id: string } | null>;
  checkout: CheckoutGateway;
}

export interface SubscriptionCancelRequestDeps {
  getCurrentUser: () => Promise<{ id: string } | null>;
  // 본인 구독의 tier와 Polar 구독 ID. Pro가 아니거나 ID가 없으면 취소 불가.
  getSubscription: (
    userId: string,
  ) => Promise<{ tier: Tier; polarSubscriptionId: string | null }>;
  // cancel=true면 기간 말 취소 예약, false면 예약 철회.
  cancelSubscription: (
    subscriptionId: string,
    cancel: boolean,
  ) => Promise<unknown>;
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
  analytics: AnalyticsPort;
}

export interface PostHogWebhookRequestDeps {
  verifyWebhook: (
    rawBody: string,
    headers: Record<string, string>,
  ) => OncallAlert;
  eventRepository: OncallEventRepository;
  dispatch: OncallDispatchGateway;
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
  // 서버측 트래킹용 진단(클라이언트 응답 AnalyzeResponse에는 노출되지 않는다).
  // request 레벨 함수가 이 메타를 보고 PostHog 이벤트를 emit한다.
  aiStatus: AiStatus;
  cacheHit: boolean;
  transactionCount: number;
}> {
  const statement = input.statement;
  const transactions = statement.transactions.map(toTransaction);
  const free = analyze(transactions);
  const source = sourceHash(statement.sourceText);
  const warnings =
    statement.warnings.length > 0 ? statement.warnings : undefined;
  const currency = resolveStatementCurrency(transactions);
  const transactionCount = transactions.length;
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
      aiStatus: "skipped",
      cacheHit: false,
      transactionCount,
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
      aiStatus: "cached",
      cacheHit: true,
      transactionCount,
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
      aiStatus: "skipped",
      cacheHit: false,
      transactionCount,
    };
  }

  const outcome = await generateInsights({
    insightProvider: input.deps.insightProvider,
    transactions,
    tier: input.tier,
    timeoutMs: input.deps.aiTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
  });

  if (outcome.status === "ok") {
    response.pro = {
      status: proStatusForTier(input.tier),
      insights: outcome.insights,
    };
  }

  return {
    response,
    transactions,
    sourceHash: source,
    needsFallback: statement.needsFallback,
    aiStatus: outcome.status,
    cacheHit: false,
    transactionCount,
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
    transactions: input.statement.transactions,
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

  emitAnalysisEvents({
    analytics: input.deps.analytics,
    userId: user.id,
    tier,
    source: "upload",
    aiStatus: analysisResult.aiStatus,
    cacheHit: analysisResult.cacheHit,
    transactionCount: analysisResult.transactionCount,
    needsFallback: analysisResult.needsFallback,
  });

  return {
    status: 200,
    body: analysisResult.response,
  };
}

// 결제 복귀 후 자동 재분석. 원본 파일은 클라이언트에 남지 않으므로, DB에 저장된
// 마지막 명세서의 정규화 거래로 Free 분석을 재계산하고 Pro면 Opus 인사이트를
// (캐시 우선) 만든다. 구독이 아직 반영되지 않았으면(웹훅 레이스) locked로 두고
// 클라이언트가 잠깐 후 재시도한다.
export async function runLatestAnalysisRequest(input: {
  deps: AnalyzeRequestDeps;
}): Promise<
  | { status: 200; body: AnalyzeResponse }
  | { status: 401; body: { error: "unauthorized" } }
  | { status: 404; body: { error: "no_statement" } }
> {
  const user = await input.deps.getCurrentUser();

  if (user === null) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const latest = await input.deps.statementRepository.loadLatestStatement(
    user.id,
  );

  if (latest === null) {
    return { status: 404, body: { error: "no_statement" } };
  }

  const tier = await input.deps.subscriptionGateway.resolveTier(user.id);
  const transactions = latest.transactions;
  const transactionCount = transactions.length;
  const response = buildLatestBaseResponse(transactions, tier);
  const inputHash = analysisInputHash({
    transactions: transactions.map(toHashTransaction),
    tier,
  });

  // 저장된 거래 재분석이라 파싱 폴백은 발생하지 않는다(needs_fallback=false 고정).
  const emit = (aiStatus: AiStatus, cacheHit: boolean): void => {
    emitAnalysisEvents({
      analytics: input.deps.analytics,
      userId: user.id,
      tier,
      source: "latest",
      aiStatus,
      cacheHit,
      transactionCount,
      needsFallback: false,
    });
  };

  const cachedInsights = toCachedInsights(
    await input.deps.aiUsage.getCachedInsights(user.id, inputHash),
  );

  if (cachedInsights !== null) {
    response.pro = {
      status: proStatusForTier(tier),
      insights: cachedInsights,
    };

    emit("cached", true);

    return { status: 200, body: response };
  }

  // 미구독은 Opus를 돌리지 않고 locked(업그레이드 CTA)로 남긴다.
  if (tier !== "pro") {
    emit("skipped", false);

    return { status: 200, body: response };
  }

  const paid = await generatePaidInsights({
    deps: input.deps,
    userId: user.id,
    transactions,
    tier,
  });

  if (paid.insights === null) {
    // quota 소진·타임아웃·잘림·에러는 unavailable로 격리(Free 결과는 보존).
    emit(paid.aiStatus, false);

    return { status: 200, body: response };
  }

  response.pro = { status: "active", insights: paid.insights };

  // 멱등 save RPC로 캐시만 추가한다(statement·거래는 이미 저장돼 중복 무시).
  // 같은 명세서를 Pro로 재업로드할 때 Opus 재호출을 피한다.
  await input.deps.statementRepository.saveStatementAnalysis({
    userId: user.id,
    statement: { sourceHash: latest.sourceHash, status: "ready" },
    transactions,
    analysis: {
      inputHash,
      model: MODEL_BY_TIER[tier],
      result: paid.insights,
    },
  });

  emit("ok", false);

  return { status: 200, body: response };
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

// 기간 말 취소(cancel=true) 또는 취소 철회(cancel=false)를 본인 구독에만
// 적용한다. tier·구독ID는 서버 세션 user.id로 조회해 클라이언트 입력을 신뢰하지
// 않는다. DB 상태는 Polar 웹훅이 동기화하므로 여기서는 Polar 호출만 수행한다.
export async function runSubscriptionCancelRequest(input: {
  cancel: boolean;
  redirectUrl: string;
  deps: SubscriptionCancelRequestDeps;
}): Promise<
  | { status: 303; redirectUrl: string }
  | { status: 401; body: { error: "unauthorized" } }
  | { status: 409; body: { error: "no_active_subscription" } }
> {
  const user = await input.deps.getCurrentUser();

  if (user === null) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const subscription = await input.deps.getSubscription(user.id);

  if (
    subscription.tier !== "pro" ||
    subscription.polarSubscriptionId === null
  ) {
    return { status: 409, body: { error: "no_active_subscription" } };
  }

  await input.deps.cancelSubscription(
    subscription.polarSubscriptionId,
    input.cancel,
  );

  return { status: 303, redirectUrl: input.redirectUrl };
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

  // 신규 처리된 active 전환만 "전환 완료"로 emit한다(결제 funnel의 마지막 단계).
  // 멱등: 재전송·중복은 위에서 duplicate로 빠지므로 전환을 두 번 세지 않는다.
  if (upsert !== null && upsert.status === "active") {
    input.deps.analytics.capture({
      distinctId: upsert.userId,
      event: "subscription_activated",
      properties: { cancel_at_period_end: upsert.cancelAtPeriodEnd },
    });
  }

  return {
    status: 200,
    body: { received: true },
  };
}

// PostHog error webhook → oncall 운영 트리거(②). Vercel serverless에서는 에이전트를
// 직접 띄울 수 없으므로, 여기서는 서명검증 + 멱등까지만 하고 GitHub repository_dispatch로
// oncall-triage 워크플로우를 깨운다(노이즈 판정·escalation은 GitHub Actions 헤드리스).
export async function runPostHogWebhookRequest(input: {
  rawBody: string;
  headers: Record<string, string>;
  deps: PostHogWebhookRequestDeps;
}): Promise<
  | { status: 200; body: { received: true; duplicate?: true } }
  | { status: 401; body: { error: "invalid_signature" } }
> {
  let alert: OncallAlert;

  try {
    alert = input.deps.verifyWebhook(input.rawBody, input.headers);
  } catch {
    return {
      status: 401,
      body: { error: "invalid_signature" },
    };
  }

  // event_id 선삽입으로 멱등 처리한다(CLAUDE.md). triage 에이전트 1회 실행은
  // 비싸므로, PostHog의 재전송·중복 전송이 같은 alert로 에이전트를 두 번 깨우지
  // 않도록 dispatch 전에 먼저 마킹한다. 이미 처리된 이벤트면 dispatch를 건너뛴다.
  const eventState = await input.deps.eventRepository.markEventProcessed(
    alert.eventId,
  );

  if (eventState === "already_processed") {
    return {
      status: 200,
      body: { received: true, duplicate: true },
    };
  }

  await input.deps.dispatch.dispatch(alert.payload);

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
    const skipped = await runAnalysis({
      statement: input.statement,
      tier: input.tier,
      deps: { skipInsights: true },
    });

    // quota 소진으로 AI를 건너뛴 경로를 'skipped'와 구분해 진단에 남긴다.
    return { ...skipped, aiStatus: "quota_exhausted" };
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
  transactions: ParsedTransaction[];
  tier: Tier;
}): string {
  const payload = JSON.stringify([
    AI_PROMPT_VERSION,
    MODEL_BY_TIER[input.tier],
    sourceHash(input.transactions),
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

// 저장된 거래로부터 인사이트 없는 기본 응답을 만든다. Free 분석은 결정론적이라
// 재계산해도 동일하고, pro.status는 tier에 따라 locked/unavailable로 둔다.
function buildLatestBaseResponse(
  transactions: Transaction[],
  tier: Tier,
): AnalyzeResponse {
  const currency = resolveStatementCurrency(transactions);

  return {
    tier,
    free: analyze(transactions),
    pro: { status: proStatusWithoutInsights(tier) },
    ...(currency !== undefined ? { currency } : {}),
  };
}

// 저장된 거래는 마스킹된 계좌만 보관한다(원본 account 미보관). 캐시 키는 account를
// 제외한 거래 필드로 계산하므로, account가 없던 명세서는 업로드 경로와 동일 키가
// 되어 cross-hit한다. account가 있던 명세서는 키가 달라 Opus를 한 번 더 부른다
// (quota 내 허용).
function toHashTransaction(transaction: Transaction): ParsedTransaction {
  return {
    date: transaction.date,
    merchant: transaction.merchant,
    signedAmount: transaction.signedAmount,
    direction: transaction.direction,
    currency: transaction.currency,
  };
}

// quota를 소비하고 Opus를 호출한다. quota 소진이면 호출 없이 quota_exhausted,
// 타임아웃·잘림·에러로 인사이트를 못 만들면 소비한 quota를 환불하고 원인별 상태를
// 진단(aiStatus)으로 호출부에 올린다. insights는 ok일 때만 채워진다.
async function generatePaidInsights(input: {
  deps: AnalyzeRequestDeps;
  userId: string;
  transactions: Transaction[];
  tier: Tier;
}): Promise<{ insights: ProInsights | null; aiStatus: AiStatus }> {
  const quotaOk = await input.deps.aiUsage.tryConsumeDailyQuota(
    input.userId,
    input.tier,
  );

  if (!quotaOk) {
    return { insights: null, aiStatus: "quota_exhausted" };
  }

  const outcome = await generateInsights({
    insightProvider: createLazyInsightProvider(
      input.deps.insightProviderFactory,
    ),
    transactions: input.transactions,
    tier: input.tier,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
  });

  if (outcome.status !== "ok") {
    await input.deps.aiUsage.releaseDailyQuota(input.userId, input.tier);

    return { insights: null, aiStatus: outcome.status };
  }

  return { insights: outcome.insights, aiStatus: "ok" };
}

// 분석 1건 처리 후 서버측 PostHog 이벤트를 emit한다. analysis_completed(항상)에
// 더해, 파싱폴백·quota소진·AI실패를 별도 이벤트로 쪼개 "조용한 실패"에 가시성을
// 만든다. distinctId는 user.id(uuid)이고 properties는 enum/수치/불리언만 — 가맹점명·
// 금액·통화·해시 등 원문 추적 가능 값은 넣지 않는다(PII/식별자 차단).
function emitAnalysisEvents(input: {
  analytics: AnalyticsPort;
  userId: string;
  tier: Tier;
  source: "upload" | "latest";
  aiStatus: AiStatus;
  cacheHit: boolean;
  transactionCount: number;
  needsFallback: boolean;
}): void {
  const { analytics, userId, tier, source } = input;

  analytics.capture({
    distinctId: userId,
    event: "analysis_completed",
    properties: {
      tier,
      source,
      ai_status: input.aiStatus,
      cache_hit: input.cacheHit,
      transaction_count: input.transactionCount,
      needs_fallback: input.needsFallback,
    },
  });

  if (input.needsFallback) {
    analytics.capture({
      distinctId: userId,
      event: "parser_fallback",
      properties: { tier },
    });
  }

  if (input.aiStatus === "quota_exhausted") {
    analytics.capture({
      distinctId: userId,
      event: "quota_exhausted",
      properties: { tier, source },
    });
  } else if (isAiFailure(input.aiStatus)) {
    analytics.capture({
      distinctId: userId,
      event: "ai_insight_failed",
      properties: { tier, reason: input.aiStatus, source },
    });
  }
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
}): Promise<AiOutcome> {
  try {
    const insights = await withTimeout(
      input.insightProvider.generate({
        transactions: input.transactions,
        tier: input.tier,
      }),
      input.timeoutMs,
    );

    return { status: "ok", insights };
  } catch (error) {
    // 실패 원인(30s 타임아웃 vs 출력 잘림 vs Claude API 에러)이 묻히지 않도록 서버
    // 로그에 남기고, 우리가 통제하는 메시지만 신뢰 가능한 핑거프린트로 분류한다
    // (그 외는 error). 호출부는 ok 외에는 pro.status=unavailable로 격리한다.
    console.error("AI insight generation failed", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("timed out")) {
      // withTimeout의 "AI insight generation timed out."(30s 초과).
      return { status: "timeout" };
    }

    if (message.includes("no parsed output")) {
      // services/claude의 "Claude returned no parsed output."(max_tokens 잘림).
      return { status: "truncated" };
    }

    return { status: "error" };
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
