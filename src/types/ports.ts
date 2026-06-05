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
