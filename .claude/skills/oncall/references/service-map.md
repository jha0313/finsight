# FinSight 서비스 맵 — 무엇이 정상인지

oncall 판정·답변의 grounding 기준. "이 에러가 핵심 경로인가 / 알려진 일시적 에러인가"를 가를 때 대조한다. 구조는 `CLAUDE.md`·`docs/ARCHITECTURE.md`가 정본이고, 여기는 운영 관점 요약이다.

## 핵심 경로 (여기서 나는 에러는 신호로 기운다)

| 경로 | 코드 | 정상 동작 |
|---|---|---|
| **결제** | `src/app/api/checkout/route.ts`, `src/app/api/webhook/polar/route.ts`, `services/polar` | Polar 체크아웃 생성 → 결제 → webhook이 `subscriptions` upsert. `customerExternalId`는 세션 `getUser().id`로 강제. |
| **인증** | `src/middleware.ts`, `src/app/auth/callback/route.ts`, `@supabase/ssr` | Google OAuth. 서버는 `getUser()`/`getClaims()`로 검증(`getSession` 불신). |
| **데이터/분석** | `src/app/api/analyze/route.ts`, `lib/csv`, `lib/analysis`, `lib/orchestration` | CSV/PDF 업로드 → 표준 파서(LLM 0) → Free 규칙·통계 + Claude 인사이트. 저장은 `save_statement_analysis` 단일 RPC 트랜잭션. |
| **Pro 게이팅** | `lib/orchestration`, `services/supabase` | 서버측 DB 구독상태로만 판정(`status active AND current_period_end > now()`). 미구독/쿼터소진은 402 아님 → **200 + Free 결과 + `pro.status=locked\|unavailable`**. |

## 알려진 일시적 에러 (노이즈로 기우는 후보 — 단발이면 깨우지 않음)

- **Claude API 타임아웃** — Opus(`claude-opus-4-8`)는 latency가 커서 30s+ 타임아웃이 가끔 난다. 설계상 실패 시 규칙·통계 결과는 보존하고 AI 인사이트만 `unavailable`로 격리된다. 단발이면 노이즈, **급증이면 신호**(모델/프롬프트 회귀 의심).
- **Opus structured-output max_tokens 잘림** — 응답이 잘리면 parse가 JSON SyntaxError를 throw → AI 인사이트가 조용히 `unavailable`(200). 반복·증가하면 신호.
- **Supabase 콜드스타트/일시 fetch 실패** — 무료 프로젝트가 pause되면 DNS NXDOMAIN으로 `fetch failed`가 연속 발생할 수 있다. **연속/지속이면 신호**(프로젝트 INACTIVE 의심 → 복구 필요).
- **third-party 일시 타임아웃**(Polar API 등) — 재시도로 해결되면 노이즈.

> 위 "일시적"이라도 **급증·지속·여러 유저**면 신호로 승격한다. 단발성·재시도 해결만 노이즈.

## 아키텍처 가드레일 (판정·수정 시 위반하지 말 것)

`CLAUDE.md`의 CRITICAL 규칙이 정본. oncall이 특히 자주 부딪히는 것:
- **금액은 `numeric`**, float/parseFloat 금지. 부호 규약 `direction(debit/credit/refund)`.
- **lib/는 외부 SDK import 금지**(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/*`). 어댑터는 route(composition root)에서 주입.
- 외부 클라이언트는 **호출 시점 지연 생성**(import 시점에 `process.env` throw 금지 — 키 없는 build/test가 깨진다).
- **카드/계좌번호는 마스킹**해 저장. Claude엔 마스킹된 거래 단위만 전달.
- **service_role 키는 webhook 모듈에서만** + `import "server-only"` 가드. `NEXT_PUBLIC_`에 비밀키 금지.
- **웹훅은 raw body 서명검증 + event_id 선삽입 멱등**(`processed_webhook_events`).

## grounding 접근 경로

- **코드** — repo 체크아웃 상태에서 직접 Read.
- **최근 배포/커밋** — `git log --oneline -20`, `git show <hash>`. Vercel CLI 자동배포이므로 main 머지 ≈ 배포.
- **PostHog** — 로그/에러/추이. CI 헤드리스에서 PostHog MCP/API가 닿으면 발생 빈도·영향 유저 확인. 못 닿으면 webhook payload 정보로 판정하고 한계 명시.
- **Supabase (read-only)** — 구독 상태 등 사실 확인. **읽기만**(`?read_only=true`). 쓰기 금지.
