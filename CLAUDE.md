# 프로젝트: finsight

임의의 카드/은행 명세서 CSV를 업로드하면 Claude로 분석해 지출 구조·이상 거래·절약 인사이트를 대시보드로 보여주는 글로벌 핀테크 SaaS MVP. 자세한 내용은 docs/PRD.md, docs/ARCHITECTURE.md, docs/ADR.md, docs/DESIGN.md 참고.

## 기술 스택
- Next.js 15 (App Router + Route Handlers)
- TypeScript strict mode
- Tailwind CSS
- 테스트: Vitest
- AI: Anthropic Claude — `@anthropic-ai/sdk` structured outputs(`messages.parse` + `output_config.format` + `zodOutputFormat()` → 검증된 `parsed_output`). 티어별 모델 라우팅: Free=`claude-sonnet-4-6`, Pro=`claude-opus-4-8`
- 인증/DB: Supabase (`@supabase/ssr`, Postgres RLS, 구글 OAuth)
- 결제: Polar.sh (`@polar-sh/nextjs`, Merchant of Record)
- 배포: Vercel (CLI 자동배포) · UI 언어 한국어 우선(글로벌 확장 지향, i18n 후속)
- 디자인: **Vantage 디자인 시스템**(`docs/DESIGN.md`) · 폰트 Pretendard(한글)+JetBrains Mono(숫자)+Inter(라틴) · 아이콘 Lucide · 토큰 정본 `.claude/skills/vantage-design/colors_and_type.css`

## 티어
- Free: 규칙·통계 분석(카테고리 분류·기간 추이·이상거래/구독누수 탐지) + Claude **Sonnet**(`claude-sonnet-4-6`) 자연어 요약·인사이트.
- Pro: 위 전부 + Claude **Opus**(`claude-opus-4-8`) 심층 분석(더 깊은 절약 인사이트·고급 분석).

## 아키텍처 규칙
- CRITICAL: 레이어 의존성은 단방향. `lib/`는 `services/`와 외부 SDK(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/*`)를 import하지 마라. 이유: 네트워크 결합이 생기면 mock-first(키 없이 테스트)가 깨진다. lib는 `types/`의 포트 인터페이스에만 의존하고, 실제 어댑터는 route handler(composition root)에서 주입한다. (Zod 등 순수 유틸은 예외)
- CRITICAL: 외부 클라이언트(Supabase/Claude/Polar)는 **호출 시점에 지연 생성**하라. 모듈 import 시점에 `process.env`를 읽어 throw하면 키 없는 build/test가 깨진다.
- CRITICAL: 모든 DB 테이블에 RLS `auth.uid() = user_id`를 적용. 서버는 `getUser()`/`getClaims()`로 검증하고 `getSession()`을 신뢰하지 마라. service_role 키는 웹훅 모듈에서만 쓰고 `import "server-only"`로 가드. `NEXT_PUBLIC_`에 비밀키 금지.
- CRITICAL: Pro 게이팅은 **서버측 DB 구독상태로만** 판정(`status active AND current_period_end > now()`). 요청 본문/헤더의 tier를 신뢰하지 마라. 미구독/쿼터소진 시 `/api/analyze`는 402가 아니라 **200 + Free 결과 + `pro.status=locked|unavailable`** 를 반환한다.
- CRITICAL: 금액은 `numeric`을 쓰고 float을 쓰지 마라. CSV 파싱 시 통화기호·콤마·괄호음수를 정규화하고 부호 규약(지출 양수/환불 음수)을 `direction(debit/credit/refund)`으로 단일화하라. 합계/소계 요약행은 필터링하라. 틀리면 모든 분석이 조용히 반대로 나온다.
- CRITICAL: CSV 컬럼 매핑은 **표준 파서 우선**, 인식 실패 시에만 **Claude 폴백 매핑** → 사용자 1회 확인/수정 → 이후 결정론적 파싱. 표준 경로는 LLM 0.
- CRITICAL: 카드·계좌번호 등 직접 식별자는 **적재 시 마스킹**해 전체값을 평문으로 저장하지 마라(전체 PAN 미보관). MVP는 마스킹 + Supabase at-rest + RLS로 보호하고 컬럼 암호화(pgcrypto)는 Post-MVP. dedup용 hash는 정규화된 평문 기준으로 계산해 별도 컬럼에 둔다.
- CRITICAL: Claude에는 **카드·계좌번호를 마스킹한 거래 단위**(가맹점명·금액·날짜·카테고리)만 전달하라(Free=Sonnet, Pro=Opus). 전체 식별자는 절대 외부로 내보내지 마라. 대용량은 행 상한/요약으로 토큰을 방어한다. opus는 latency가 크므로 `timeout`(예: 30s)을 두고, 실패·초과 시 규칙·통계 결과는 보존하고 AI 인사이트는 `unavailable`로 격리하라.
- CRITICAL: 체크아웃의 `customerExternalId`는 클라이언트 입력이 아니라 **서버 세션 `getUser().id`로 강제**하라.
- CRITICAL: 분석은 **동기 처리**. `statements`·`transactions`·`analyses` 저장은 일반 다중 호출이 아니라 **Postgres RPC 단일 트랜잭션**(`save_statement_analysis`)으로 하고, 중간 실패 시 전체 rollback하라. Vercel `maxDuration`을 상향하라.
- AI 분석 결과는 `analyses`에 **`unique(user_id, input_hash)`** 로 캐시 — 동일 입력(거래 단위 입력+모델+프롬프트 버전) 재분석 시 재호출을 skip한다. Claude 호출(Free=Sonnet/Pro=Opus)은 `ai_usage_daily` 원자 카운터로 **tier별 일일 quota**를 적용한다.
- 웹훅은 **raw body 서명검증** + `processed_webhook_events.event_id` 선삽입으로 멱등 처리한다.
- 컴포넌트는 props만 받는 dumb으로 만들고, 계산·포맷·파싱·마스킹 로직은 `lib/`로 분리(TDD 대상)한다. 디렉토리: `src/{app,components,lib,services,types}`.
- CRITICAL: UI는 Vantage 디자인 시스템(`docs/DESIGN.md`·`.claude/skills/vantage-design/`)을 따른다. 색은 **토큰만 참조**하고 hex를 인라인하지 마라. accent는 `--primary` #0052ff **단일**(CTA·링크·워드마크만), display는 **weight 400**, 모든 숫자는 **JetBrains Mono(tabular)**, 트레이딩 그린/레드는 텍스트 색으로만(배경 fill 금지). 한글은 **Pretendard**. 화면에 'Vantage' 노출 금지(제품명 = finsight). 예외: **토큰화된 AI 시그니처 그라데이션(`--ai-gradient`)·글로우(`--ai-glow`)·`--ai-violet`**은 **AI 맥락(인사이트/Pro)·다크 밴드에서만** 허용(일반 CTA·링크는 `--primary` 단일 유지, hex 인라인은 여전히 금지).

## 개발 프로세스
- CRITICAL: 비즈니스 로직(`lib/`·`services/`)은 테스트를 먼저 작성하고, 통과하는 구현을 작성하라(TDD).
- 각 작업은 `npm run lint && npm run build && npm run test`가 통과한 상태(green)로 끝내라.
- 커밋 메시지는 conventional commits 형식(feat:, fix:, docs:, refactor:, test:, chore:).

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
