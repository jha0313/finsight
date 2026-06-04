# Step 2: auth-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 상태 관리(서버 상태=Route Handlers, 구독상태 진실원천=웹훅), 보안(RLS·getUser)
- `/AGENTS.md` — CRITICAL: `getUser()`/`getClaims()`로 검증, `getSession()` 신뢰 금지. `NEXT_PUBLIC_`에 비밀키 금지. 구글 OAuth.
- `/docs/PRD.md` — 사용자 여정(구글 로그인 → CSV 업로드)
- `/src/services/supabase/*`(step 1) — `createServerSupabaseClient`·`getCurrentUser`(재사용)

step 1의 Supabase 어댑터를 재사용하라. 인증 로직을 재구현하지 마라.

## 작업

`@supabase/ssr` 기반 인증 흐름을 작성한다. 비즈니스 로직(브랜치·리다이렉트 판정)은 TDD로, 페이지/콜백 wiring은 최소화한다.

### 구성 (재량, 아래 책임은 유지)

- **세션 미들웨어** `src/middleware.ts` — 요청마다 Supabase 세션을 갱신하고, 보호 경로(예: `/dashboard`)는 미인증 시 로그인으로 리다이렉트. `getUser()`로 검증.
- **구글 OAuth 로그인** — `signInWithOAuth({ provider: 'google' })` 트리거(서버 액션 또는 라우트). 로그인 페이지 `src/app/(auth)/login/page.tsx`(최소 UI, Vantage 토큰).
- **OAuth 콜백** `src/app/auth/callback/route.ts` — 코드 교환 후 대시보드로 리다이렉트.

### 핵심 규칙 (벗어나지 마라)

- **getUser 검증**: 보호 경로 판정은 `getUser()`(검증된 사용자)로 하라. `getSession()`을 신뢰하지 마라. 이유: CRITICAL 보안.
- **지연 생성**: step 1의 lazy 클라이언트를 쓰고, 새로 import-시점 env throw를 만들지 마라(키 없이 build green).
- **비밀키 노출 금지**: 클라이언트로 비밀키를 내보내지 마라. `NEXT_PUBLIC_`엔 publishable만.
- **테스트 가능 구조**: 미들웨어/콜백의 **분기·리다이렉트 판정 로직**은 목 가능한 함수로 분리해 TDD하라(TDD 가드가 `middleware.ts`·`route.ts` 같은 비-page `.ts`에 테스트를 요구한다). 페이지(`page.tsx`)는 가드 면제.
- **레이어**: 인증 헬퍼는 `src/services/supabase`를 통해 쓰고, app 코드는 services·types만 참조한다.

### 테스트 (네트워크 0)

- 미인증 → 로그인 리다이렉트, 인증 → 통과(미들웨어 판정 로직, getUser 목).
- 콜백이 코드 교환 후 의도한 경로로 리다이렉트하는지.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 보호 경로 판정이 `getUser()` 기반인가(`getSession` 아님)?
   - 키 없이 build green인가(lazy)? 비밀키가 클라이언트로 새지 않는가?
   - 미들웨어/콜백 분기 로직이 테스트로 검증됐는가?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 미들웨어·로그인·콜백 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요(예: 구글 OAuth 클라이언트 설정·키) → `"status": "blocked"`, `"blocked_reason"` 후 중단. (단, 코드 작성과 build/test는 키 없이 가능해야 하므로 가급적 blocked 없이 완료)

## 금지사항

- `getSession()`을 인가 판정에 쓰지 마라. 이유: CRITICAL — 위조 가능, `getUser()`로 검증.
- 비밀키를 `NEXT_PUBLIC_`이나 클라이언트로 내보내지 마라. 이유: CRITICAL 보안.
- import 시점 env throw를 만들지 마라. 이유: 키 없는 build/test가 깨진다.
- 인증 로직을 step 1과 별개로 재구현하지 마라. 이유: 단일 출처 유지.
- `/api/analyze`·대시보드 UI를 만들지 마라. 이유: step 3·4·5 범위.
- 기존 테스트를 깨뜨리지 마라.
