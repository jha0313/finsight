# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 디렉토리 구조와 단방향 레이어 의존성(이 step에서 ESLint로 강제)
- `/docs/ADR.md` — ADR-001(Next.js15), ADR-003(mock-first), ADR-008(Vitest)
- `/AGENTS.md` — 프로젝트 규칙(CRITICAL 항목)
- `/docs/DESIGN.md` — 토큰 통합 위치(토큰 자체는 step 3에서, 여기선 Tailwind 베이스라인만)

이 step은 프로젝트의 토대다. 이후 모든 step이 여기서 깔린 스캐폴딩 위에서 실행되므로 정확히 깔아라.

## 작업

빈 저장소(`package.json` 없음)를 Next.js 15 풀스택 스캐폴딩으로 부트스트랩한다.

1. **Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v4** 프로젝트를 현재 디렉토리 루트에 초기화한다.
   - `create-next-app`을 쓰든 수동 구성하든 결과 상태만 만족하면 된다(에이전트 재량).
   - **App Router**(`src/app/`), **TypeScript strict mode**(`tsconfig.json`의 `"strict": true`), **src 디렉토리**, **import alias `@/*` → `src/*`**.
   - Tailwind는 **v4(CSS-first)** — `@import "tailwindcss";`와 `@tailwindcss/postcss` 플러그인. `src/app/globals.css`는 베이스라인만(디자인 토큰은 step 3).

2. **디렉토리 골격**을 만든다(빈 디렉토리는 `.gitkeep`으로 추적):
   ```
   src/app/         # 이미 생성됨 (layout.tsx, page.tsx, globals.css)
   src/components/
   src/lib/
   src/services/
   src/types/
   ```
   `src/app/layout.tsx`와 `src/app/page.tsx`는 `next build`가 성공하는 최소 형태로 둔다(브랜딩/카피는 후속 step).

3. **npm scripts** (`package.json`):
   - `dev`  → `next dev`
   - `build`→ `next build`
   - `lint` → ESLint 실행(예: `eslint .` 또는 `next lint`) — 경고 없이 통과해야 함
   - `test` → **`vitest run`** (반드시 비-watch. watch면 verify-gate 훅이 hang됨)

4. **ESLint 레이어 가드** (`eslint.config.mjs`, flat config) — ARCHITECTURE.md의 단방향 의존성을 `no-restricted-imports`로 강제한다. 아래 경계가 **실제로 위반 시 lint 에러**가 나야 한다:
   - `src/lib/**`: `src/services` 및 외부 SDK(`@anthropic-ai/sdk`, `@supabase/*`, `@polar-sh/*`) import 금지. (lib는 `src/types`와 순수 유틸[zod 등]에만 의존)
   - `src/types/**`: 런타임 값 import 금지(leaf). `@/lib`, `@/services`, `@/app`, 외부 SDK import 금지 — `src/types` 내부 type-only import만 허용.
   - `src/services/**`: `src/lib`, `src/app` import 금지. (services는 `src/types`만 안다)
   - 추가로 `import/no-cycle`(eslint-plugin-import 또는 import-x)로 순환 의존을 차단한다. 플러그인/리졸버 구성은 재량.

5. **Vitest 설정** (`vitest.config.ts`): path alias `@/` → `src/` 해석, 테스트 환경 `node`(컴포넌트 테스트용 jsdom은 후속 step에서 필요 시 추가). `npm test`가 아래 스모크 테스트를 green으로 통과해야 한다.

6. **스모크 테스트** `src/__tests__/smoke.test.ts` 1개를 작성한다(자명한 단언 1개). 이유: Vitest는 테스트 0개면 실패하고, verify-gate 훅이 `npm test`를 매번 실행하므로 최소 1개의 통과 테스트가 필요하다.

### 핵심 규칙 (벗어나지 마라)

- **mock-first / 키 없이 green** — 어떤 모듈도 import 시점에 `process.env`(Supabase/Polar/Anthropic 키)를 읽어 throw하지 마라. 이 step은 외부 SDK를 설치/배선하지 않는다. `npm run build`는 `.env`의 Supabase/Polar 키가 비어 있어도 성공해야 한다.
- **레이어 가드는 형식이 아니라 실효** — `no-restricted-imports` 규칙이 실제로 동작하도록 패턴을 정확히 적어라(`files` 스코프 사용). 이 강제가 ARCHITECTURE.md의 핵심이다.

## Acceptance Criteria

```bash
npm install
npm run lint    # 경고/에러 0
npm run build   # 컴파일 에러 없음 (Supabase/Polar 키 비어 있어도 성공)
npm test        # 스모크 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - `src/{app,components,lib,services,types}` 디렉토리가 존재하는가?
   - `tsconfig.json`에 `"strict": true`, alias `@/*`가 있는가?
   - `package.json`의 `test`가 `vitest run`(비-watch)인가?
   - ESLint에 lib/types/services 레이어 `no-restricted-imports` 규칙이 들어갔는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 산출물 한 줄 요약(생성된 설정 파일·디렉토리·핵심 결정)
   - 수정 3회 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- Supabase/Polar/Anthropic SDK를 설치하거나 클라이언트를 배선하지 마라. 이유: 이 step은 스캐폴딩만이고, 자격증명 없이 build/test가 green이어야 한다(다음 페이즈 범위).
- `src/lib/`·`src/services/`에 비즈니스 로직 `.ts`를 만들지 마라. 이유: 범위 밖이며 TDD 가드(테스트 선행)에 걸린다.
- 디자인 토큰·hex 색을 `globals.css`에 인라인하지 마라. 이유: 토큰 통합은 step 3(design-tokens).
- `test` 스크립트를 watch 모드(`vitest`)로 두지 마라. 이유: verify-gate 훅이 hang된다.
- 기존 테스트를 깨뜨리지 마라.
