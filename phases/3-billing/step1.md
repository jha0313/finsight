# Step 1: checkout-route

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-005(`customerExternalId`는 클라이언트 입력이 아니라 서버 세션 `getUser().id`로 강제)
- `/AGENTS.md` — CRITICAL: 체크아웃의 `customerExternalId`는 서버 세션 uid로 강제. 게이팅은 DB로만.
- `/src/services/polar/index.ts`(step 0) — `createPolarCheckout`
- `/src/services/supabase/index.ts`(phase 2) — `getCurrentUser`
- `/src/app/api/analyze/route.ts`(phase 2) — composition root 패턴 참고

## 작업

`src/app/api/checkout/route.ts`(또는 적절한 세그먼트)를 composition root로 작성한다. **얇은 wiring** + 분기는 테스트 가능한 함수로 분리해 TDD한다.

### 책임 (흐름)

1. `getCurrentUser()` → 미인증이면 **401**.
2. `customerExternalId = user.id` — **서버 세션에서 강제**. 요청 본문/쿼리의 customer id를 신뢰하지 마라.
3. `createPolarCheckout().create({ customerExternalId: user.id, productId: <POLAR_PRODUCT_ID> })` → 체크아웃 URL.
4. 체크아웃 URL로 리다이렉트(또는 `{ url }` 반환).

### 핵심 규칙 (벗어나지 마라)

- **customerExternalId 서버강제**: `customerExternalId`는 **반드시 `getCurrentUser().id`**로 채워라. 클라이언트가 보낸 customer/external id를 절대 쓰지 마라. 이유: CRITICAL — 위조하면 타인 계정으로 구독을 붙일 수 있다.
- **지연 생성 주입**: Polar 어댑터는 route에서 호출 시점 생성. 시크릿을 import 시점에 읽지 마라.
- **테스트 가능**: 미인증 401, 인증 시 user.id로 체크아웃 생성됨을 목으로 TDD하라.
- **레이어**: route(app)는 `src/services`·`src/types`를 wiring한다.

### 테스트 (네트워크 0)

- 미인증 → 401.
- 인증 → `createPolarCheckout().create`가 **user.id를 customerExternalId로** 호출하는지(목으로 인자 검증). 클라이언트가 보낸 임의 customer id가 무시되는지.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 목으로 네트워크 0인가?
   - `customerExternalId`가 서버 세션 uid로만 채워지는가(클라 입력 무시)?
   - 미인증 401인가? 어댑터가 route에서 지연 생성되는가?
3. 결과에 따라 `phases/3-billing/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 체크아웃 흐름 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `customerExternalId`를 요청 본문/쿼리/헤더에서 채우지 마라. 이유: CRITICAL — 서버 세션 uid로 강제(위조 방지).
- import 시점에 Polar 시크릿을 읽어 throw하지 마라. 이유: 키 없는 build/test가 깨진다.
- 웹훅·구독 DB 쓰기·UI를 만들지 마라. 이유: step 2·3 범위.
- 기존 테스트를 깨뜨리지 마라.
