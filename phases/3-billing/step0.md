# Step 0: polar-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-005(Polar 웹훅=구독 진실원천; raw body 서명검증; `customerExternalId`는 서버 세션 uid로 강제; Merchant of Record)
- `/AGENTS.md` — CRITICAL: 외부 클라이언트 지연 생성. 웹훅은 raw body 서명검증 + `processed_webhook_events.event_id` 선삽입 멱등. service_role은 웹훅 모듈만 + `import "server-only"`. `NEXT_PUBLIC_`에 비밀키 금지.
- `/docs/ARCHITECTURE.md` — `services/`는 `types/`만 안다(순환 방지)
- `/.env`(키 이름만) — `POLAR_SERVER`·`POLAR_ACCESS_TOKEN`·`POLAR_WEBHOOK_SECRET`·`POLAR_PRODUCT_ID`
- `/src/services/supabase/index.ts`(phase 2) — `subscriptions` 형태(`SubscriptionGateway`가 읽는 status·current_period_end)

## 작업

`src/services/polar/`에 Polar 어댑터를 **TDD로** 작성한다(테스트 먼저). 의존성: `@polar-sh/nextjs`(및 필요 시 `@polar-sh/sdk`).

### 시그니처 (내부 구현은 재량)

```ts
// 체크아웃 세션 생성. customerExternalId는 인자로 받되, 호출부(route)가 서버 세션 uid를 넘긴다(아래 규칙).
export function createPolarCheckout(): {
  create(input: { customerExternalId: string; productId?: string; successUrl?: string }): Promise<{ url: string }>;
};

// 웹훅 raw body + 서명 헤더 검증 후 파싱된 이벤트 반환(검증 실패 시 throw).
export function verifyPolarWebhook(rawBody: string, headers: Record<string, string>): { eventId: string; type: string; data: unknown };

// Polar 구독 이벤트 → subscriptions upsert에 쓸 정규화 데이터.
export function toSubscriptionUpsert(event: { type: string; data: unknown }): {
  userId: string;            // customerExternalId(= 서버 세션 uid)에서 도출
  polarSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
} | null;
```

### 핵심 규칙 (벗어나지 마라)

- **지연 생성(lazy)**: Polar 클라이언트/시크릿(`POLAR_ACCESS_TOKEN`·`POLAR_WEBHOOK_SECRET`·`POLAR_SERVER`·`POLAR_PRODUCT_ID`)은 **호출 시점**에 읽어라. import 시 env throw 금지(키 없이 build/test green).
- **raw body 서명검증**: `verifyPolarWebhook`은 **가공 전 raw body**와 서명 헤더로 검증한다. JSON 파싱 후 검증하면 안 된다(서명 불일치).
- **customerExternalId는 신뢰 입력이 아님**: 어댑터는 `customerExternalId`를 인자로만 받는다. 클라이언트 입력에서 채우는 코드를 어댑터에 넣지 마라(route가 서버 세션 uid를 강제 주입한다).
- **레이어**: `src/services/polar`는 `src/types`·`@polar-sh/*`만 import. `src/lib`·`src/app`·`src/services/supabase` import 금지(순환 방지·단방향). DB 쓰기는 어댑터가 아니라 웹훅 route가 한다.

### 테스트 (네트워크 0)

- `@polar-sh/*`를 **목으로 대체**.
- `create`가 주어진 `customerExternalId`로 체크아웃을 만드는지(클라 입력을 자체적으로 읽지 않음).
- `verifyPolarWebhook`이 raw body 기준 검증이고, 서명 불일치 시 throw하는지.
- `toSubscriptionUpsert`가 이벤트 타입별로 status·period·userId를 정규화하는지.

## Acceptance Criteria

```bash
npm install
npm run lint && npm run build && npm test   # 키 없이 green (lazy init)
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? `@polar-sh/*` 목으로 네트워크 0인가?
   - 클라이언트/시크릿이 지연 생성인가(키 없이 build green)?
   - 서명검증이 raw body 기준인가? 어댑터가 customerExternalId를 인자로만 받는가?
   - `src/services/polar`가 `src/lib`/`src/app`/`src/services/supabase`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/3-billing/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 어댑터 함수 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- import 시점에 Polar 시크릿을 읽어 throw하지 마라. 이유: CRITICAL — 키 없는 build/test가 깨진다.
- raw body가 아닌 가공/파싱된 본문으로 서명검증하지 마라. 이유: 서명이 raw body 기준이라 검증이 깨진다.
- 어댑터에서 DB(subscriptions)를 직접 쓰지 마라. 이유: DB 쓰기는 웹훅 route(step 2)가 service_role로 한다.
- `src/services/supabase`·`src/lib`·`src/app`을 import하지 마라. 이유: services는 types만 안다(순환 방지).
- 체크아웃/웹훅 라우트·UI를 만들지 마라. 이유: step 1·2·3 범위.
- 실제 Polar API를 호출하는 테스트를 작성하지 마라. 이유: 네트워크 0 — 목으로 검증.
- 기존 테스트를 깨뜨리지 마라.
