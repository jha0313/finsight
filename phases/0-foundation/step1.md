# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 레이어(`types/`는 leaf, 값 import 0) + DB 스키마 요약(타입이 미러해야 할 필드)
- `/docs/ADR.md` — ADR-004(InsightProvider 포트·티어별 모델 라우팅·마스킹 거래단위), ADR-006(direction·금액 정규화), ADR-009(식별자 마스킹), ADR-007(category 코드 상수 union)
- `/AGENTS.md` — 금액 numeric/float 금지, 마스킹, Pro 게이팅 CRITICAL 규칙
- step 0 산출물: `tsconfig.json`(alias `@/*`), `src/types/`, ESLint 레이어 가드(`src/types/**`는 런타임 import 금지)

step 0에서 깔린 디렉토리 구조와 ESLint 규칙을 먼저 읽고, 그 제약 안에서 작업하라.

## 작업

`src/types/`에 도메인 타입과 포트 인터페이스를 작성한다. **전부 type-only**(`export type`/`export interface`)이며 런타임 값·외부 SDK를 import하지 않는다(leaf 레이어).

파일 분할(권장, 재량 조정 가능):

- `src/types/transaction.ts`
- `src/types/statement.ts`
- `src/types/analysis.ts`
- `src/types/tier.ts`
- `src/types/csv.ts`
- `src/types/ports.ts`
- `src/types/index.ts` (배럴 re-export)

### 시그니처 수준 지시 (내부는 재량, 아래 형태/제약은 유지)

```ts
// tier.ts
export type Tier = 'free' | 'pro';
export type ProStatus = 'active' | 'locked' | 'unavailable';

// transaction.ts
export type Direction = 'debit' | 'credit' | 'refund';
// category는 코드 상수 union (ADR-007: categories 테이블 없음). 대표값으로 시작해 확장.
export type Category =
  | 'food' | 'transport' | 'shopping' | 'utilities'
  | 'entertainment' | 'health' | 'finance' | 'income' | 'other';

export interface Transaction {
  date: string;          // ISO 'YYYY-MM-DD'
  merchant: string;
  signedAmount: string;  // 결정: 금액은 decimal 문자열로 표현 (CRITICAL: float 금지). 부호 규약 = 지출 양수 / 환불 음수.
  direction: Direction;
  category: Category;
  currency: string;      // ISO 4217 (예: 'KRW', 'USD')
  maskedAccount?: string; // 마스킹된 직접 식별자만. 전체 PAN/계좌번호 미보관.
  rowHash: string;        // 정규화된 평문 기준 dedup 해시
}

// statement.ts
export type StatementStatus = 'ready' | 'failed';
export interface Statement {
  id: string;
  userId: string;
  status: StatementStatus;
  sourceHash: string;     // unique(user_id, source_hash)
  createdAt: string;
}

// csv.ts — 표준 파서 → (실패 시) Claude 폴백 매핑 → 결정론적 파싱
export type CanonicalField = 'date' | 'merchant' | 'amount' | 'debit' | 'credit' | 'currency' | 'account';
export interface CsvMapping {
  columns: Record<CanonicalField, string | null>; // canonical → 원본 헤더명
  source: 'standard' | 'fallback';                // 표준 파서 매핑 vs Claude 폴백
}

// analysis.ts
export interface CategoryBreakdown { category: Category; total: string; count: number; }
export interface TrendPoint { period: string; total: string; }
export interface Anomaly { kind: 'subscription_leak' | 'outlier' | string; merchant: string; detail: string; }
export interface FreeAnalysis {
  byCategory: CategoryBreakdown[];
  trend: TrendPoint[];
  anomalies: Anomaly[];
}
export interface ProInsights {  // Claude(Free=Sonnet/Pro=Opus) 자연어 인사이트
  summary: string;
  insights: string[];
}
// /api/analyze 응답 형태: 미구독/실패 시에도 200 + free 보존 + pro.status로 잠금 표현
export interface AnalyzeResponse {
  tier: Tier;
  free: FreeAnalysis;
  pro: { status: ProStatus; insights?: ProInsights };
  warnings?: string[];
}

// ports.ts — lib(오케스트레이션)이 의존하는 포트. 실제 어댑터는 route(composition root)에서 주입.
import type { Transaction } from './transaction';
import type { Tier } from './tier';
import type { ProInsights } from './analysis';

export interface InsightProvider {
  // 입력은 마스킹된 거래 단위만. tier로 모델 라우팅(Free=Sonnet/Pro=Opus)은 어댑터 책임.
  generate(input: { transactions: Transaction[]; tier: Tier }): Promise<ProInsights>;
}
export interface SubscriptionGateway {
  // 서버 DB 구독상태로만 tier 판정 (status active AND current_period_end > now()). 요청 본문/헤더 신뢰 금지.
  resolveTier(userId: string): Promise<Tier>;
}
export interface StatementRepository {
  // save_statement_analysis RPC 단일 트랜잭션 래퍼. 중간 실패 시 전체 rollback.
  saveStatementAnalysis(input: SaveStatementAnalysisInput): Promise<{ statementId: string }>;
}
export interface SaveStatementAnalysisInput {
  userId: string;
  statement: { sourceHash: string; status: import('./statement').StatementStatus };
  transactions: Transaction[];
  analysis?: { inputHash: string; model: string; result: unknown };
}
```

위는 형태/제약을 박은 골격이다. 필드 추가·이름 조정은 설계 의도(마스킹·부호·DB-only 게이팅·티어 라우팅)를 깨지 않는 선에서 재량.

### 핵심 규칙 (벗어나지 마라)

- **leaf 레이어**: `src/types/`는 런타임 값을 import하지 않는다. `import type`만 쓰고, 외부 SDK(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/*`)·`@/lib`·`@/services`·`@/app`을 import하지 마라. (step 0 ESLint 가드가 이를 강제한다)
- **금액은 decimal 문자열**(`signedAmount: string`). number/float로 바꾸지 마라. 이유: CRITICAL — float이면 분석이 조용히 틀어진다.
- **마스킹 식별자만**: 타입에 전체 카드/계좌번호 필드를 두지 마라. `maskedAccount?`만.
- **AnalyzeResponse**는 미구독/실패 시에도 free를 보존하고 `pro.status`로 잠금을 표현하는 형태여야 한다(402 아님).

## Acceptance Criteria

```bash
npm run lint    # types/ 레이어 가드 위반 0
npm run build   # 타입 컴파일 에러 없음
npm test        # 기존 스모크 테스트 green 유지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `src/types/`의 모든 파일이 type-only인가(런타임 값 export 0)?
   - 외부 SDK/`@/lib`/`@/services` import가 없는가(ESLint green)?
   - `signedAmount`가 string인가? `Tier`/`ProStatus`/`Direction`이 union으로 있는가?
   - 포트(`InsightProvider`·`SubscriptionGateway`·`StatementRepository`)가 정의됐는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 타입 파일·포트 목록 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `src/lib/`·`src/services/`에 구현 코드를 만들지 마라. 이유: 이 step은 타입/포트 정의만(구현은 다음 페이즈).
- `src/types/`에서 런타임 값이나 외부 SDK를 import하지 마라. 이유: leaf 레이어가 깨지면 mock-first가 붕괴된다.
- `signedAmount`를 number로 바꾸지 마라. 이유: CRITICAL float 금지.
- 기존 테스트를 깨뜨리지 마라.
