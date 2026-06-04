# 프로젝트: finsight

CSV(카드 명세서·거래내역)를 업로드하면 Claude로 분석해 대시보드로 보여주는 핀테크 SaaS MVP.

## 기술 스택
- Next.js 15 (App Router + Route Handlers)
- TypeScript strict mode
- Tailwind CSS
- 테스트: Vitest
- AI: Anthropic Claude — `@anthropic-ai/sdk` structured outputs(`messages.parse` + `output_config.format` + `zodOutputFormat()` → 검증된 `parsed_output`), 기본 모델 `claude-opus-4-8`
- 인증/DB: Supabase (`@supabase/ssr`, Postgres RLS, 구글 OAuth)
- 결제: Polar.sh (`@polar-sh/nextjs`)
- 배포: Vercel (CLI 자동배포) · 언어 한국어

## 아키텍처 규칙
- CRITICAL: 레이어 의존성은 단방향. `lib/`는 `services/`와 외부 SDK(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/*`)를 import하지 마라. 이유: 네트워크 결합이 생기면 mock-first(키 없이 테스트)가 깨진다. lib는 `types/`의 포트 인터페이스에만 의존하고, 실제 어댑터는 route handler(composition root)에서 주입한다. (Zod 등 순수 유틸은 예외)
- CRITICAL: 외부 클라이언트(Supabase/Claude/Polar)는 **호출 시점에 지연 생성**하라. 모듈 import 시점에 `process.env`를 읽어 throw하면 키 없는 build/test가 깨진다.
- CRITICAL: 모든 DB 테이블에 RLS `auth.uid() = user_id`를 적용. 서버는 `getUser()`/`getClaims()`로 검증하고 `getSession()`을 신뢰하지 마라. service_role 키는 웹훅 모듈에서만 쓰고 `import "server-only"`로 가드. `NEXT_PUBLIC_`에 비밀키 금지.
- CRITICAL: Pro 게이팅은 **서버측 DB 구독상태로만** 판정(`status active AND current_period_end > now()`). 요청 본문/헤더의 tier를 신뢰하지 마라. 미구독/쿼터소진 시 `/api/analyze`는 402가 아니라 **200 + Free 결과 + `pro.status=locked|unavailable`** 를 반환한다.
- CRITICAL: 금액은 `numeric`을 쓰고 float을 쓰지 마라. CSV 파싱 시 통화기호·콤마·괄호음수를 정규화하고 부호 규약(지출 양수/환불 음수)을 `direction(debit/credit/refund)`으로 단일화하라. 합계/소계 요약행은 필터링하라. 틀리면 모든 분석이 조용히 반대로 나온다.
- CRITICAL: Claude에는 **원본 거래를 보내지 마라**. lib가 만든 집계 통계·요약만 전달한다(제3자 PII 노출·토큰 폭발·비용 방어). 모델 `claude-opus-4-8`은 latency가 크므로 `timeout`(예: 30s)을 두고, 실패·초과 시 Free 결과는 보존하고 `pro.status=unavailable`로 격리하라.
- CRITICAL: 체크아웃의 `customerExternalId`는 클라이언트 입력이 아니라 **서버 세션 `getUser().id`로 강제**하라.
- CRITICAL: 분석은 **동기 처리**. `statements`·`transactions`·`analyses` 저장은 일반 다중 호출이 아니라 **Postgres RPC 단일 트랜잭션**(`save_statement_analysis`)으로 하고, 중간 실패 시 전체 rollback하라. Vercel `maxDuration`을 상향하라.
- Pro 분석 결과는 `analyses`에 **`unique(user_id, input_hash)`** 로 캐시 — 동일 입력(거래 집계+모델+프롬프트 버전) 재분석 시 opus 재호출을 skip한다. Pro 호출은 `ai_usage_daily` 원자 카운터로 **일일 quota**를 적용한다.
- 웹훅은 **raw body 서명검증** + `processed_webhook_events.event_id` 선삽입으로 멱등 처리한다.
- 컴포넌트는 props만 받는 dumb으로 만들고, 계산·포맷 로직은 `lib/`로 분리(TDD 대상)한다. 디렉토리: `src/{app,components,lib,services,types}`.

## 개발 프로세스
- CRITICAL: 비즈니스 로직(`lib/`·`services/`)은 테스트를 먼저 작성하고, 통과하는 구현을 작성하라(TDD).
- 각 작업은 `npm run lint && npm run build && npm run test`가 통과한 상태(green)로 끝내라.
- 커밋 메시지는 conventional commits 형식(feat:, fix:, docs:, refactor:, test:, chore:).

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
