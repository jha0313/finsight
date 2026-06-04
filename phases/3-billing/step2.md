# Step 2: webhook-route

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-005(웹훅=구독 진실원천; raw body 서명검증; `processed_webhook_events.event_id` 선삽입 멱등; 게이팅은 DB로만)
- `/AGENTS.md` — CRITICAL: 웹훅은 raw body 서명검증 + event_id 선삽입 멱등. service_role은 웹훅 모듈만 + `import "server-only"`. `NEXT_PUBLIC_`에 비밀키 금지.
- `/docs/ARCHITECTURE.md` — DB 스키마(`subscriptions`·`processed_webhook_events`), 구독상태 진실원천=웹훅
- `/supabase/migrations/0001_init.sql` — `subscriptions`·`processed_webhook_events` 컬럼
- `/src/services/polar/index.ts`(step 0) — `verifyPolarWebhook`·`toSubscriptionUpsert`
- `/.env`(키 이름만) — `SUPABASE_SERVICE_ROLE_KEY`·`POLAR_WEBHOOK_SECRET`

## 작업

`src/app/api/webhook/polar/route.ts`(POST)를 작성한다. 멱등·검증 로직은 테스트 가능한 함수로 분리해 TDD한다. 의존성 필요 시 `@supabase/supabase-js`(service_role 클라이언트).

### 책임 (흐름 — 순서 중요)

1. **raw body** 수신(`await request.text()`) + 서명 헤더로 `verifyPolarWebhook(rawBody, headers)` 검증. 실패 → **401**.
2. **멱등 선삽입**: `processed_webhook_events(event_id)`에 **먼저 insert**. 이미 존재(conflict)면 **이미 처리됨 → 200 즉시 반환**(재처리 금지).
3. 신규 이벤트면 `toSubscriptionUpsert(event)` → `subscriptions` upsert(`user_id` = customerExternalId).
4. 200 반환.

### service_role 클라이언트 (이 모듈 전용)

- `subscriptions`/`processed_webhook_events` 쓰기는 사용자 세션이 없으므로 **service_role** 클라이언트로 한다(RLS 우회).
- service_role 클라이언트 생성 모듈 최상단에 **`import "server-only"`**를 두어 클라이언트 번들 유입을 차단하라.
- `SUPABASE_SERVICE_ROLE_KEY`는 **호출 시점 지연**으로 읽어라(import 시 throw 금지). **웹훅 외 어디서도 service_role을 쓰지 마라.**

### 핵심 규칙 (벗어나지 마라)

- **raw body 검증**: 반드시 가공 전 raw 문자열로 서명검증. `request.json()`으로 먼저 파싱하면 서명이 깨진다.
- **멱등은 선삽입**: 처리 **전에** `event_id`를 insert해 충돌로 중복을 막아라. 처리 후 insert면 중복 처리 창이 생긴다.
- **service_role 격리**: `import "server-only"` 가드 + 웹훅 모듈 전용 + 지연 생성. `NEXT_PUBLIC_`에 service_role 키 금지.
- **게이팅 불변**: 이 step은 `subscriptions`를 채울 뿐, 게이팅 판정 로직(phase 2 `SubscriptionGateway`: `status active AND current_period_end > now()`)은 건드리지 마라.

### 테스트 (네트워크 0)

- 서명 검증 실패 → 401(목 `verifyPolarWebhook` throw).
- 이미 처리된 event_id(선삽입 conflict) → 200 + upsert 미수행.
- 신규 이벤트 → subscriptions upsert 호출됨(목 service_role 클라이언트로 인자 검증).
- service_role 클라이언트가 지연 생성(import 시 throw 없음).

## Acceptance Criteria

```bash
npm install
npm run lint && npm run build && npm test   # 키 없이 green

grep -rIn 'server-only' src/app/api/webhook src/services 2>/dev/null | head   # service_role 모듈 가드 확인
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? raw body 검증 + event_id 선삽입 멱등이 테스트로 검증됐는가?
   - service_role 모듈에 `import "server-only"`가 있고 지연 생성인가? 웹훅 외 사용이 없는가?
   - 이미 처리된 이벤트가 재처리되지 않는가(conflict → 200 skip)?
3. 결과에 따라 `phases/3-billing/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 웹훅 검증·멱등·upsert 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `request.json()` 등 가공 본문으로 서명검증하지 마라. 이유: CRITICAL — raw body 기준이라 검증이 깨진다.
- event_id를 처리 후에 insert하지 마라. 이유: CRITICAL — 선삽입이라야 중복 처리를 막는다(멱등).
- service_role 키를 웹훅 외 모듈에서 쓰거나 `NEXT_PUBLIC_`/클라이언트로 노출하지 마라. 이유: CRITICAL 보안 — `server-only` 가드 + 웹훅 전용.
- import 시점에 시크릿을 읽어 throw하지 마라. 이유: 키 없는 build/test가 깨진다.
- 게이팅 판정 로직을 바꾸지 마라. 이유: phase 2 `SubscriptionGateway` 단일 출처 유지.
- 실제 Supabase/Polar에 연결하는 테스트를 작성하지 마라. 이유: 네트워크 0 — 목으로 검증.
- 기존 테스트를 깨뜨리지 마라.
