# Architecture Decision Records

## 철학
MVP 속도 최우선. "작동하는 최소"가 미덕 — 운영하다 필요해지는 것은 출시 전에 짓지 않는다. 단, 핀테크라 **보안·금액 정합성은 타협하지 않는다**.

---

### ADR-001: Next.js 15 풀스택
**결정**: App Router + Route Handlers로 프론트·백을 한 코드베이스에서.
**이유**: Vercel 배포 최적, MVP 속도.
**트레이드오프**: 무거운 백엔드 로직엔 부적합하나 MVP엔 충분.

### ADR-002: 분석은 동기 처리 + Postgres RPC 단일 트랜잭션
**결정**: `/api/analyze` 한 요청에서 파싱→분석→저장. 저장은 `save_statement_analysis` RPC로 statement/transaction/analysis를 한 트랜잭션에 묶고 중간 실패 시 전체 rollback.
**이유**: 한국 카드 명세서는 행 수가 작아(수백~수천) 요청 내 처리 가능 → 비동기 큐·상태머신이 불필요. Supabase JS 다중 호출은 원자성이 없어 좀비 statement가 생기므로 RPC로 묶는다.
**트레이드오프**: opus 4.8 latency 탓에 Vercel `maxDuration` 상향(필요 시 Pro 플랜) + Claude `timeout` 필요. 5만 행/장시간은 행 상한으로 방어. 실측 문제 시 비동기 도입.

### ADR-003: 외부 서비스 mock-first
**결정**: Claude/Supabase/Polar를 포트 뒤에 두고 호출 시점 지연 생성. 단위 테스트는 테스트 더블.
**이유**: Harness 자율실행이 키 없이 build/test green이어야 끊기지 않는다.
**트레이드오프**: 어댑터 보일러플레이트. 단 포트는 핵심(InsightProvider 등)으로 최소화.

### ADR-004: Claude structured outputs + opus 4.8 + 집계만 전달
**결정**: `messages.parse` + `output_config.format` + `zodOutputFormat()`으로 검증된 `parsed_output` 수신. 모델 `claude-opus-4-8`. 원본 거래 대신 **집계 통계만** 전달. `timeout` 30s, 실패·초과 시 Free 보존 + `pro.status=unavailable` 격리.
**이유**: 스키마 준수 보장(파싱 재시도 불필요) + 제3자 PII 노출·토큰 폭발·비용을 동시에 방어.
**트레이드오프**: opus는 latency·비용이 큼 → `analyses` 캐시(`unique(user_id,input_hash)`)로 동일 입력 재호출을 skip하고, `ai_usage_daily` 원자 카운터로 일일 quota를 적용해 비용 폭탄을 막는다. Zod `.min/.max` 등 미지원 → 범위 검증은 후처리.

### ADR-005: Polar 웹훅 = 구독 진실원천
**결정**: 체크아웃 리다이렉트를 신뢰하지 않고 웹훅(raw body 서명검증)으로 `subscriptions` upsert. `processed_webhook_events.event_id` 선삽입으로 재전송 멱등, timestamp/version guard로 out-of-order 방어. 게이팅은 DB 상태로만.
**이유**: 결제 정합성. 체크아웃 `customerExternalId`는 서버 세션 uid로 강제(위조 방지).
**트레이드오프**: 웹훅 누락 시 checkout 후 polling 보조. out-of-order guard는 MVP 단순화 시 생략 가능(event_id 멱등은 필수).

### ADR-006: 부호/금액 정규화 규약
**결정**: 금액은 `numeric`. 통화기호·콤마·괄호음수 strip, 출금/입금 2컬럼은 `출금-입금`으로 단일화, `signed_amount` + `direction(debit/credit/refund)`. 합계/소계 요약행은 휴리스틱 필터.
**이유**: 한국 카드사 CSV 포맷이 제각각. 부호가 틀리면 모든 분석이 조용히 반대로 나옴 → 가장 먼저 TDD.
**트레이드오프**: 카드사별 포맷 매핑 유지 비용 → MVP는 대표 1~2개로 제한.

### ADR-007: 스키마 단순화 (profiles·categories 제거)
**결정**: profiles 미러·categories 테이블을 만들지 않음. user_id는 `auth.users` 직접 FK, category는 코드 상수 union.
**이유**: MVP에 조인·시드·가입 트리거 부담만 늘림.
**트레이드오프**: 표시용 닉네임 등 미러 컬럼이 필요해지면 그때 profiles 추가.

### ADR-008: 테스트러너 Vitest
**결정**: Vitest 채택.
**이유**: esbuild 기반 무설정·빠른 watch. TDD·Stop훅 반복 실행에 유리, TS/ESM 설정 부담 최소.
**트레이드오프**: 생태계는 Jest가 크나 MVP 로직 테스트엔 Vitest로 충분.
