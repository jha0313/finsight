# Architecture Decision Records

## 철학
MVP 속도 최우선. "작동하는 최소"가 미덕 — 운영하다 필요해지는 것은 출시 전에 짓지 않는다. 단, 핀테크라 **보안·금액 정합성·프라이버시 경계는 타협하지 않는다**: "무엇을 저장하고 무엇을 외부로 보내느냐"를 결정의 기준으로 둔다. 1차 타겟은 글로벌(영어권) 얼리어답터.

---

### ADR-001: Next.js 15 풀스택
**결정**: App Router + Route Handlers로 프론트·백을 한 코드베이스에서.
**이유**: Vercel 배포 최적, MVP 속도.
**트레이드오프**: 무거운 백엔드 로직엔 부적합하나 MVP엔 충분.

### ADR-002: 분석은 동기 처리 + Postgres RPC 단일 트랜잭션
**결정**: `/api/analyze` 한 요청에서 파싱→분석→저장. 저장은 `save_statement_analysis` RPC로 statement/transaction/analysis를 한 트랜잭션에 묶고 중간 실패 시 전체 rollback.
**이유**: 카드/은행 명세서는 보통 행 수가 작아(수백~수천) 요청 내 처리 가능 → 비동기 큐·상태머신이 불필요. Supabase JS 다중 호출은 원자성이 없어 좀비 statement가 생기므로 RPC로 묶는다.
**트레이드오프**: opus 4.8 latency 탓에 Vercel `maxDuration` 상향(필요 시 Pro 플랜) + Claude `timeout` 필요. 대용량은 행 상한으로 방어. 실측 문제 시 비동기 도입.

### ADR-003: 외부 서비스 mock-first
**결정**: Claude/Supabase/Polar를 포트 뒤에 두고 호출 시점 지연 생성. 단위 테스트는 테스트 더블.
**이유**: Harness 자율실행이 키 없이 build/test green이어야 끊기지 않는다.
**트레이드오프**: 어댑터 보일러플레이트. 단 포트는 핵심(InsightProvider 등)으로 최소화.

### ADR-004: Claude structured outputs + opus 4.8 + 마스킹된 거래 단위 전달
**결정**: `messages.parse` + `output_config.format` + `zodOutputFormat()`으로 검증된 `parsed_output` 수신. 모델 `claude-opus-4-8`(Pro 전용). 입력은 카드·계좌번호를 마스킹한 **거래 단위 데이터**(가맹점명·금액·날짜·카테고리). `timeout` 30s, 실패·초과 시 Free 보존 + `pro.status=unavailable` 격리.
**이유**: 스키마 준수 보장(파싱 재시도 불필요) + 가맹점 수준의 구체 인사이트를 위해 거래 단위를 전달하되, 직접 식별자는 마스킹해 제3자 PII 노출을 차단. Free는 LLM 0이라 opus 비용은 Pro에만 발생.
**트레이드오프**: 집계만 보내는 대안보다 토큰이 크고 가맹점명이 외부로 나감(구체 인사이트 위해 의도적 허용). 비용은 ① 대용량 행 상한/요약 ② `analyses` 캐시(`unique(user_id,input_hash)`)로 동일 입력 재호출 skip ③ `ai_usage_daily` 일일 quota로 방어. Zod `.min/.max` 미지원 → 범위 검증 후처리.

### ADR-005: Polar 웹훅 = 구독 진실원천
**결정**: 체크아웃 리다이렉트를 신뢰하지 않고 웹훅(raw body 서명검증)으로 `subscriptions` upsert. `processed_webhook_events.event_id` 선삽입으로 재전송 멱등. 게이팅은 DB 상태로만. 체크아웃 `customerExternalId`는 서버 세션 uid로 강제(위조 방지).
**이유**: 결제 정합성. Polar는 Merchant of Record라 VAT/세금을 대신 처리해 글로벌 판매에 적합.
**트레이드오프**: 웹훅 누락 시 checkout 후 polling 보조. out-of-order guard는 MVP 범위 밖(event_id 멱등으로 충분, 필요해지면 후속 도입).

### ADR-006: CSV — 표준 파서 우선 + Claude 폴백 매핑, 부호/금액 정규화
**결정**: 표준 파서로 먼저 컬럼 매핑·파싱을 시도하고 **인식 실패 시에만** Claude로 매핑 추론 → 사용자 1회 확인/수정 → 이후 결정론적 파싱. 금액은 `numeric`, 통화기호·콤마·괄호음수 strip, 출금/입금 2컬럼은 `출금-입금`으로 단일화해 `signed_amount` + `direction(debit/credit/refund)`. 합계/소계 요약행은 휴리스틱 필터.
**이유**: 은행·카드사마다 CSV 포맷이 제각각이고 글로벌엔 표준이 없어 호환성이 필요하나, 매번 LLM을 태우면 비용·지연이 큼 → 표준 경로는 LLM 0, 폴백만 토큰 사용. 부호가 틀리면 모든 분석이 조용히 반대로 나오므로 정규화는 가장 먼저 TDD.
**트레이드오프**: 표준 파서 + 폴백 분기 복잡도 + 폴백 매핑 토큰 비용. 표준 포맷 커버리지는 대표 1~2개로 시작해 점진 확장.

### ADR-007: 스키마 단순화 (profiles·categories 제거)
**결정**: profiles 미러·categories 테이블을 만들지 않음. user_id는 `auth.users` 직접 FK, category는 코드 상수 union.
**이유**: MVP에 조인·시드·가입 트리거 부담만 늘림.
**트레이드오프**: 표시용 닉네임 등 미러 컬럼이 필요해지면 그때 profiles 추가.

### ADR-008: 테스트러너 Vitest
**결정**: Vitest 채택.
**이유**: esbuild 기반 무설정·빠른 watch. TDD·Stop훅 반복 실행에 유리, TS/ESM 설정 부담 최소.
**트레이드오프**: 생태계는 Jest가 크나 MVP 로직 테스트엔 Vitest로 충분.

### ADR-009: 식별자 마스킹 우선, 컬럼 암호화는 Post-MVP
**결정**: 카드·계좌번호 등 직접 식별자는 적재 시 마스킹해 전체값을 평문 저장하지 않음. 나머지 거래 데이터는 Supabase at-rest + RLS로 보호하고, pgcrypto 컬럼 암호화는 Post-MVP로 미룸. dedup용 `source_hash`/`row_hash`는 정규화된 평문 기준으로 계산해 별도 컬럼에 저장.
**이유**: 분석엔 가맹점·금액·날짜면 충분하므로 전체 카드번호는 애초에 보관하지 않는 게 노출면을 가장 줄인다. 키 관리가 필요한 컬럼 암호화는 MVP 부담이 큰 데 비해, 식별자 미보관 + at-rest + RLS로 MVP 위험은 충분히 통제된다.
**트레이드오프**: 더 강한 기밀성(규제 등)이 요구되면 컬럼 암호화를 후속 도입. dedup/집계는 암호화와 무관한 hash·정규화 컬럼으로 처리.

### ADR-010: 핵심 분석 루프를 가장 먼저 빌드
**결정**: ①기반(Next.js+Supabase Auth+스키마) → ②핵심 루프(업로드→표준파싱/폴백→마스킹→Free 룰베이스 분석→대시보드) → ③랜딩+샘플 데모 → ④Polar 결제+게이팅+Pro(opus) 인사이트.
**이유**: 최대 리스크는 "임의 CSV → 신뢰할 만한 분석"이 실제로 작동하느냐. 그게 검증돼야 랜딩·결제가 의미를 가짐. Free 루프(LLM 0)가 먼저 서면 Pro는 그 위에 얹는다.
**트레이드오프**: 수익화(결제·Pro)가 뒤로 밀림. 대신 작동하지 않는 제품에 결제를 붙이는 위험을 회피.
