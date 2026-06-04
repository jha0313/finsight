# Step 1: supabase-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — DB 스키마·RPC `save_statement_analysis`·RLS·구독상태 진실원천. `services/`는 `types/`만 안다.
- `/docs/ADR.md` — ADR-002(RPC 단일 트랜잭션), ADR-005(구독 진실원천), ADR-009(마스킹)
- `/AGENTS.md` — CRITICAL: 지연 생성. Pro 게이팅은 서버 DB 구독상태로만(`status active AND current_period_end > now()`). `getUser()`/`getClaims()`로 검증, `getSession()` 신뢰 금지. service_role은 웹훅 모듈만 + `import "server-only"`. RPC 단일 트랜잭션 저장. `analyses` 캐시 `unique(user_id,input_hash)`. `ai_usage_daily` 일일 quota.
- `/src/types/ports.ts` — `StatementRepository`·`SubscriptionGateway`·`SaveStatementAnalysisInput`
- `/supabase/migrations/0001_init.sql` — 실제 테이블·RPC 시그니처(컬럼·파라미터 일치 확인)
- `/src/types/tier.ts` — `Tier`

## 작업

`src/services/supabase/`에 Supabase 어댑터를 **TDD로** 작성한다(테스트 먼저). 의존성: `@supabase/ssr`, `@supabase/supabase-js`.

### 시그니처 (내부 구현은 재량)

```ts
// SSR 서버 클라이언트(쿠키 기반). 호출 시점 지연 생성.
export function createServerSupabaseClient(): SupabaseClient;

// auth 헬퍼 — getUser()로 검증(getSession 신뢰 금지).
export async function getCurrentUser(): Promise<{ id: string } | null>;

// StatementRepository 구현 — save_statement_analysis RPC 호출(단일 트랜잭션).
export function createStatementRepository(): StatementRepository;

// SubscriptionGateway 구현 — DB 구독상태로만 tier 판정.
export function createSubscriptionGateway(): SubscriptionGateway;

// AI quota/캐시 보조 (route가 사용). ai_usage_daily 원자 증가, analyses 캐시 조회.
export function createAiUsage(): {
  getCachedInsights(userId: string, inputHash: string): Promise<unknown | null>;
  tryConsumeDailyQuota(userId: string, tier: Tier): Promise<boolean>; // 한도 내면 증가 후 true
};
```

### 핵심 규칙 (벗어나지 마라)

- **지연 생성(lazy)**: 클라이언트는 **호출 시점**에 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 읽어 생성하라. import 시 env throw 금지(키 없는 build/test green).
- **게이팅은 DB로만**: `resolveTier`는 `subscriptions`에서 **`status='active' AND current_period_end > now()`**일 때만 `'pro'`, 아니면 `'free'`. 요청 본문/헤더 신뢰 금지.
- **auth 검증**: `getUser()`(또는 getClaims) 사용. `getSession()`을 신뢰하지 마라.
- **RPC 단일 트랜잭션**: `saveStatementAnalysis`는 `supabase.rpc('save_statement_analysis', {...})`로 호출하라. 일반 다중 insert로 분해하지 마라(원자성). 파라미터는 마이그레이션의 RPC 시그니처(`p_user_id`, `p_statement_source_hash`, `p_statement_status`, `p_transactions`, `p_analysis`)와 일치시켜라.
- **캐시/쿼터**: `analyses`는 `unique(user_id,input_hash)`로 조회(동일 입력 재호출 skip). `ai_usage_daily`는 원자 증가로 tier별 일일 quota.
- **service_role 금지(이 step)**: service_role 키는 쓰지 마라(웹훅 전용 — phase 3). 일반 경로는 publishable 키 + RLS로 동작한다. `NEXT_PUBLIC_`에 비밀키를 넣지 마라.
- **레이어**: `src/services/supabase`는 `src/types`와 `@supabase/*`만 import. `src/lib`·`src/app` import 금지(ESLint 가드).

### 테스트 (네트워크 0)

- `@supabase/ssr`/클라이언트를 **목으로 대체**.
- `resolveTier`: active+미래 period → 'pro', 만료/없음 → 'free'.
- `saveStatementAnalysis`가 `rpc('save_statement_analysis', ...)`를 올바른 파라미터로 호출하는지.
- 클라이언트가 지연 생성되는지(import 시 throw 없음).

## Acceptance Criteria

```bash
npm install
npm run lint && npm run build && npm test   # 키 없이 green (lazy init)
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 클라이언트 목으로 네트워크 0인가?
   - 지연 생성으로 키 없이 build green인가?
   - `resolveTier`가 DB 구독상태(active AND 미래 period)로만 판정하는가?
   - `saveStatementAnalysis`가 RPC 단일 호출이고 마이그레이션 시그니처와 일치하는가?
   - `src/services/supabase`가 `src/lib`/`src/app`을 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 클라이언트·repo·gateway·quota 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- import 시점에 env를 읽어 throw하지 마라. 이유: CRITICAL — 키 없는 build/test가 깨진다.
- 게이팅을 요청 본문/헤더 tier로 판정하지 마라. 이유: CRITICAL — 서버 DB 구독상태로만.
- 저장을 일반 다중 insert로 분해하지 마라. 이유: CRITICAL — RPC 단일 트랜잭션이어야 좀비 데이터가 없다.
- service_role 키를 쓰지 마라. 이유: 웹훅 전용(phase 3) — 일반 경로는 RLS로 보호.
- `src/lib`/`src/app`을 import하지 마라. 이유: services는 types만 안다.
- 실제 Supabase에 연결하는 테스트를 작성하지 마라. 이유: 네트워크 0 — 목으로 검증.
- 기존 테스트를 깨뜨리지 마라.
