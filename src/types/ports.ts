import type { ProInsights } from "./analysis";
import type { ExtractedTransaction } from "./pdf";
import type { StatementStatus } from "./statement";
import type { Tier } from "./tier";
import type { Transaction } from "./transaction";

export interface InsightProvider {
  generate(input: {
    transactions: Transaction[];
    tier: Tier;
  }): Promise<ProInsights>;
}

// PDF는 은행마다 레이아웃이 제각각이라 결정론적 표준 파서로 일반화하기
// 어렵다. 마스킹된 명세서 텍스트에서 거래 단위를 추출하는 책임을 port로
// 분리하고, 실제 Claude 어댑터는 composition root(route)에서 주입한다.
export interface PdfTransactionExtractor {
  extract(input: { text: string }): Promise<ExtractedTransaction[]>;
}

export interface SubscriptionGateway {
  resolveTier(userId: string): Promise<Tier>;
}

export interface StatementRepository {
  saveStatementAnalysis(
    input: SaveStatementAnalysisInput,
  ): Promise<{ statementId: string }>;
  // 결제 복귀 후 자동 재분석을 위해, 저장된 가장 최근 명세서의 거래를 그대로
  // 불러온다. 원본 파일은 클라이언트에 남지 않으므로 DB의 정규화된 거래가
  // 유일한 재분석 입력이다. 저장된 명세서가 없으면 null.
  loadLatestStatement(userId: string): Promise<LatestStatement | null>;
}

export interface LatestStatement {
  // analyses 캐시 멱등 저장에 재사용할 statement의 source_hash.
  sourceHash: string;
  transactions: Transaction[];
}

export interface AiUsageGateway {
  getCachedInsights(userId: string, inputHash: string): Promise<unknown | null>;
  tryConsumeDailyQuota(userId: string, tier: Tier): Promise<boolean>;
  // 완료되지 못한 Claude 호출(타임아웃·에러·fallback)에 소모된 quota를 환불한다.
  releaseDailyQuota(userId: string, tier: Tier): Promise<void>;
}

// 서버측 제품 이벤트·예외를 외부 분석(PostHog)으로 보낸다. lib는 이 포트에만
// 의존하고, 실제 posthog-node 어댑터는 route handler(composition root)에서 주입한다
// (CLAUDE.md: lib는 외부 SDK를 직접 import하지 않는다). capture/captureException은
// 동기(어댑터 내부 큐잉)이고, flush는 serverless(Vercel 람다)에서 응답 반환 직후
// freeze로 in-flight 이벤트가 유실되지 않도록 호출부에서 await한다. PII(이메일·계좌·
// 가맹점명·금액·요약텍스트)는 properties에 넣지 않는다.
export interface AnalyticsPort {
  capture(input: {
    distinctId: string;
    event: string;
    properties?: Record<string, string | number | boolean | undefined>;
  }): void;
  flush(): Promise<void>;
}

export interface CheckoutGateway {
  create(input: {
    customerExternalId: string;
    productId?: string;
    successUrl?: string;
  }): Promise<{ url: string }>;
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  data: unknown;
}

export interface SubscriptionUpsertPayload {
  userId: string;
  polarSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  // 기간 말 취소 예약 여부. status는 active로 유지되므로 게이팅에는 영향을
  // 주지 않지만, "기간 종료 후 Free 전환 예정" 표시를 위해 보존한다.
  cancelAtPeriodEnd: boolean;
  // 구독 객체의 변경 시각. 순서 보장이 없는 웹훅에서 stale 이벤트가 최신
  // 상태를 덮어쓰지 않도록 조건부 upsert의 기준으로 쓴다. (없으면 null)
  eventTimestamp: string | null;
}

export interface WebhookSubscriptionRepository {
  markEventProcessed(
    eventId: string,
  ): Promise<"inserted" | "already_processed">;
  upsertSubscription(input: SubscriptionUpsertPayload): Promise<void>;
}

// oncall(운영) prod alert 트리거. PostHog error webhook을 검증·정규화한 결과로,
// 멱등 키(eventId)와 triage 워크플로우에 그대로 넘길 payload를 담는다.
export interface OncallAlert {
  eventId: string;
  payload: unknown;
}

// 새 alert만 triage 에이전트를 깨우도록 event_id 선삽입 멱등을 담당한다
// (Polar와 같은 processed_webhook_events 테이블을 공유하되 키는 prefix로 분리).
export interface OncallEventRepository {
  markEventProcessed(
    eventId: string,
  ): Promise<"inserted" | "already_processed">;
}

// GitHub repository_dispatch(event_type: oncall-alert)로 oncall-triage 워크플로우를
// 깨운다. 실제 에이전트(노이즈 판정·escalation)는 GitHub Actions에서 헤드리스로 돈다.
export interface OncallDispatchGateway {
  dispatch(payload: unknown): Promise<void>;
}

export interface SaveStatementAnalysisInput {
  userId: string;
  statement: {
    sourceHash: string;
    status: StatementStatus;
  };
  transactions: Transaction[];
  analysis?: {
    inputHash: string;
    model: string;
    result: unknown;
  };
}
