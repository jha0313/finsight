# 브라우저 테스트 플레이북

finsight를 브라우저로 수동/자동 검증할 때 매번 참조하는 시나리오 모음. 각 시나리오는
**목적 · 전제 · 단계 · 기대결과 · 코드 근거**로 구성된다. 결정론적으로 반복 가능하도록
기대결과는 화면 텍스트/상태 기준으로 적는다.

> 관련 문서: 제품 맥락은 `docs/PRD.md`, 구조는 `docs/ARCHITECTURE.md`,
> 프로비저닝(키 설정)은 `docs/SETUP.md`.

---

## 0. 환경 매트릭스 (실행 전 반드시 확인)

테스트로 어디까지 갈 수 있는지는 `.env` 키 설정 상태가 가른다.

| 키 | 미설정 시 동작 | 영향받는 시나리오 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_KEY` | `isSupabaseConfigured()`→false. 미들웨어가 미인증 처리, `getCurrentUser()`→null | 로그인, 대시보드 진입, `/api/analyze` 인증 |
| `SUPABASE_SERVICE_ROLE_KEY` | 웹훅 구독 반영 불가 | Polar 웹훅 |
| `ANTHROPIC_API_KEY` | Claude 인사이트 생성 불가(규칙·통계 분석은 유지) | AI 요약/인사이트 |
| `POLAR_*` | 체크아웃 URL 생성·웹훅 검증 불가 | Pro 결제 |

**현재 로컬 기준선(2026-06):** Supabase·Polar = 미설정, Anthropic = 설정됨.
→ 그룹 A는 키 없이 그대로 검증 가능. 그룹 B(로그인 이후 업로드→분석)는 키가 없으면
막히므로 **부록 F의 임시 우회 픽스처**를 적용해서 검증한다.

확인 명령:

```bash
# dev 서버 (이미 떠 있으면 생략)
npm run dev            # http://localhost:3000

# env 키 설정 여부만 출력(값은 숨김)
grep -oE '^[A-Z_]+=' .env | sed 's/=$//' | while read k; do \
  v=$(grep "^$k=" .env | cut -d= -f2-); \
  [ -z "$v" ] && echo "$k: (빈값)" || echo "$k: SET"; done
```

---

## 그룹 A — 키 없이 즉시 검증 (현재 기준선에서 바로 실행)

미설정 강등 경로를 포함해, 외부 키 없이 끝까지 도는 시나리오.

### S-A1. 랜딩 첫인상 + 샘플 데모
- **목적:** 첫 진입 인상과, 로그인 없이 실제 분석 결과를 보여주는 샘플 데모 섹션 검증.
- **전제:** 없음.
- **단계:**
  1. `/` 진입.
  2. Hero 영역의 헤드라인 "명세서에서 지출의 구조를 읽습니다"와 미리보기 카드(₩2,480,000 / -18%) 확인.
  3. 아래로 스크롤 → "핵심 가치" 섹션 안의 샘플 데모 영역 확인.
- **기대결과:**
  - 헤드라인이 배경과 충분히 대비되어 읽힌다(가시성 회귀 방지 — `Hero.tsx`).
  - 샘플 데모에 카테고리 분포·기간 추이·이상거래·AI 요약/인사이트가 **실제 값으로** 렌더된다(빈 자리표시자 아님).
  - 콘솔 에러 없음.
- **코드 근거:** `src/app/page.tsx`(Hero/FeatureGrid demoSlot), `src/app/_demo/sample-demo.ts`(SSR로 `runAnalysis` 실행, `demoInsightProvider` 사용 — Claude 호출 없음), `src/app/_demo/SampleDemoSection.tsx`.

### S-A2. CTA 동선 → /login 수렴
- **목적:** 전환 동선의 모든 CTA가 로그인으로 모이는지.
- **전제:** 없음.
- **단계:**
  1. `/`에서 Hero의 "Google로 시작" 클릭 위치 확인.
  2. 가격 섹션의 "Free로 시작", "Pro 시작" 확인.
- **기대결과:** 세 CTA 모두 `href="/login"`. 클릭 시 `/login`으로 이동.
- **코드 근거:** `src/app/page.tsx`(Hero `ctaHref="/login"`, plans `ctaHref:"/login"`).

### S-A3. 미인증 대시보드 접근 차단
- **목적:** 보호 경로가 미인증 사용자를 로그인으로 보내는지(미들웨어 게이팅).
- **전제:** Supabase 미설정(기준선) — 미설정이면 항상 미인증으로 처리됨.
- **단계:**
  1. 주소창에 `/dashboard` 직접 입력.
- **기대결과:** `/login?next=%2Fdashboard`로 리다이렉트. 런타임 throw·500 없음.
- **코드 근거:** `src/middleware.ts`, `src/services/supabase/index.ts`(`PROTECTED_PATH_PREFIXES=["/dashboard"]`, `resolveMiddlewareAuthDecision`).

### S-A4. OAuth 우아한 강등
- **목적:** Supabase 키가 없을 때 로그인 시도가 throw 없이 에러 상태로 강등되는지.
- **전제:** Supabase 미설정(기준선).
- **단계:**
  1. `/login` 진입.
  2. "Google로 계속하기" 클릭.
- **기대결과:** `/login?error=oauth&next=…`로 되돌아오고 "로그인 연결을 완료하지 못했습니다." 표시. 500 없음.
- **⚠️ KNOWN ISSUE(2026-06-04 발견):** 현재 `createGoogleOAuthUrl`에 `isSupabaseConfigured()` 가드가 없어, 미설정 시 null 반환 대신 `createServerSupabaseClient()`가 **throw → POST /login 500**. `getCurrentUser`(index.ts:239)와 동일한 가드 1줄을 `createGoogleOAuthUrl`(index.ts:132)에 추가하면 해소. 수정 전까지 이 시나리오는 500이 정상 관측값.
- **코드 근거:** `src/app/(auth)/login/page.tsx`(`signInWithGoogle`→`createGoogleOAuthUrl` null→`error=oauth` redirect).

### S-A5. 분석 API 인증 게이팅 (401)
- **목적:** 인증 없이 분석 엔드포인트를 직접 호출하면 거부되는지.
- **전제:** Supabase 미설정(기준선).
- **단계:**
  1. CSV 본문으로 `POST /api/analyze` 호출(브라우저 fetch 또는 curl).
  ```bash
  curl -i -X POST http://localhost:3000/api/analyze \
    -H 'content-type: text/csv' \
    --data-binary $'날짜,가맹점,금액\n2026-06-01,테스트,1000'
  ```
- **기대결과:** `401` + `{"error":"unauthorized"}`.
- **코드 근거:** `src/lib/orchestration/index.ts`(`runAnalyzeRequest`: `user===null`→401).

### S-A6. 반응형 / 접근성 스냅샷
- **목적:** 주요 폭에서 레이아웃이 깨지지 않고 시맨틱/색 토큰이 유지되는지.
- **전제:** 없음.
- **단계:**
  1. `/`를 360px(모바일)·768px(태블릿)·1280px(데스크탑)에서 스크린샷.
  2. 가로 스크롤·요소 겹침·잘림 확인.
- **기대결과:** 폭별로 레이아웃 정상. CTA 버튼은 `--primary` 단일 강조. 숫자는 tabular(JetBrains Mono).
- **코드 근거:** Vantage 토큰 — `docs/DESIGN.md`, `.claude/skills/vantage-design/colors_and_type.css`.

---

## 그룹 B — 로그인 이후 플로우 (키 또는 부록 F 우회 필요)

현재 기준선에서는 막혀 있다. **부록 F 픽스처**를 적용하거나, `docs/SETUP.md`대로 실제 키를
채운 뒤 실행한다. 아래 단계는 부록 F 우회가 적용된 상태를 가정한다.

### S-B1. 업로드 → Free 분석 렌더
- **목적:** CSV 업로드가 결정론적 파싱→규칙·통계 분석→화면 렌더로 이어지는지.
- **전제:** 부록 F 적용(미들웨어 통과 + 데모 deps). 검증용 CSV는 `src/app/_demo/sample-demo.ts`의 `sampleStatementCsv`를 파일로 저장해 사용.
- **단계:**
  1. `/dashboard` 진입(부록 F로 통과됨).
  2. "CSV 파일" 입력에 샘플 CSV 선택 → "명세서 분석" 클릭.
  3. 로딩("분석 중입니다.") 후 결과 영역 확인.
- **기대결과:**
  - 카테고리 도넛, 기간 추이, 이상거래 목록(반복결제 누수/이상치)이 렌더된다.
  - 금액 부호 규약대로 환불이 합계에서 제외된다(지출 흐름만 비교).
  - 빈 상태 "분석 결과가 아직 없습니다."가 결과로 대체된다.
- **코드 근거:** `src/components/UploadPanel.tsx`→`POST /api/analyze`→`DashboardResults`. 분석 코어 `src/lib/orchestration/index.ts`(`runAnalysis`).

### S-B2. Pro 게이팅 상태 표시 (Free 티어)
- **목적:** Free 응답에서 Pro 영역이 잠금 상태로 정확히 표기되는지.
- **전제:** 부록 F(`resolveTier`→`"free"`).
- **단계:** S-B1 결과 화면에서 인사이트 패널 상태 확인.
- **기대결과:** `pro.status="locked"`. InsightsPanel이 잠금/업셀 상태로 렌더(402 아님, 200 응답 본문 안에서 구분).
- **코드 근거:** `src/lib/orchestration/index.ts`(`proStatusForTier("free")="locked"`), `src/components/InsightsPanel.tsx`.

### S-B3. AI 인사이트 경로 (선택, Anthropic 키 필요)
- **목적:** 실제 Claude(Free=Sonnet) 요약/인사이트가 생성·표시되는지, timeout 격리가 동작하는지.
- **전제:** 부록 F에서 `insightProviderFactory: createClaudeInsightProvider`(실제 호출) 선택. `ANTHROPIC_API_KEY` 설정됨.
- **단계:** S-B1과 동일하게 업로드 후 인사이트 영역 관찰.
- **기대결과:** Sonnet 요약 1개 + 인사이트 N개가 채워진다. 30s 초과·실패 시 규칙·통계 결과는 보존되고 인사이트만 비는 격리 동작.
- **주의:** 실제 토큰 비용·latency 발생. 결정론·무비용으로 UI만 볼 때는 부록 F의 `demoInsightProvider`를 사용.
- **코드 근거:** `src/services/claude/index.ts`(`createClaudeInsightProvider`), `runAnalysis`의 `withTimeout`(기본 30s).

### S-B4. Pro 결제·웹훅 (실제 키 전용 — 우회 불가)
- **목적:** 체크아웃 리다이렉트와 웹훅 멱등 처리.
- **전제:** `POLAR_*` 실제 설정. 데모 우회로는 의미 있게 검증 불가(외부 MoR 흐름).
- **단계/기대결과:** `docs/SETUP.md`의 Polar 절차로 별도 검증. 본 플레이북에서는 범위 외로 표시.
- **코드 근거:** `src/app/api/checkout/route.ts`, `src/app/api/webhook/polar/route.ts`, `runCheckoutRequest`/`runPolarWebhookRequest`.

---

## 부록 F. 그룹 B 임시 우회 픽스처 (커밋 금지)

Supabase 키 없이 그룹 B를 브라우저로 보기 위한 **1회용 로컬 패치**. 인증/DB만 데모로
대체하고 분석 코어·UI는 실제 코드를 그대로 탄다. **반드시 테스트 후 원복**한다.

### F-1. 미들웨어 통과 (`/dashboard` 진입용)
`src/middleware.ts`에서 미인증 기본값을 임시로 인증됨으로:

```diff
- let isAuthenticated = false;
+ let isAuthenticated = true; // TEMP: 브라우저 테스트 우회 — 커밋 금지
```

### F-2. 분석 라우트 deps 교체 (`401` 회피)
`src/app/api/analyze/route.ts`의 `runAnalyzeRequest({ deps: { … } })`를 데모 deps로 교체:

```ts
const result = await runAnalyzeRequest({
  csv,
  deps: {
    getCurrentUser: async () => ({ id: "demo-user" }),
    subscriptionGateway: { resolveTier: async () => "free" },
    aiUsage: {
      getCachedInsights: async () => null,
      tryConsumeDailyQuota: async () => true,
    },
    statementRepository: {
      saveStatementAnalysis: async () => ({ statementId: "demo-statement" }),
    },
    // UI만 빠르게 볼 때: demoInsightProvider(무비용·결정론)
    // AI 경로까지 검증할 때: createClaudeInsightProvider(실제 Sonnet, 토큰 비용)
    insightProviderFactory: createClaudeInsightProvider,
  },
});
```

> `demoInsightProvider`는 `src/app/_demo/sample-demo.ts`에서 import. deps 타입은
> `AnalyzeRequestDeps`(`src/lib/orchestration/index.ts`)와 정확히 일치해야 한다.

### F-3. 원복 (필수)

```bash
git checkout src/middleware.ts src/app/api/analyze/route.ts
npm run lint && npm run build && npm run test   # green 확인
```

---

## 부록 T. 트러블슈팅

### T-1. 페이지가 unstyled(맨몸 HTML)로 뜨고 정적 자원이 전부 404
- **증상:** `/` 진입 시 레이아웃·폰트·색이 모두 빠진 plain HTML. 콘솔에
  `/_next/static/css/app/layout.css`, `…/chunks/main-app.js` 등이 404.
- **원인:** `next dev`가 살아 있는 동안 `npm run build`(production)가 `.next`를 덮어써서
  dev 산출물과 production 해시 파일이 뒤섞임. HTML은 dev 경로(해시 없음)를 참조하는데
  `.next/static`엔 production 해시 파일만 남아 404. (메모리 `harness-build-race`와 동일 레이스)
- **진단:**
  ```bash
  curl -s http://localhost:3000/ | grep -oE '/_next/static/[^"?]*' | sort -u
  ls .next/static/css/app/      # 비어 있으면 오염
  ls .next/static/css/          # 해시 .css만 있으면 production 산출물
  ```
- **복구:**
  ```bash
  lsof -ti :3000 -sTCP:LISTEN | xargs kill        # 기존(고아) dev 서버 종료
  rm -rf .next                                     # 오염 제거
  npm run dev                                      # 깨끗하게 재시작
  ```
- **예방:** dev 서버가 떠 있는 동안 `npm run build`를 돌리지 말 것. 빌드 검증은 dev를
  멈추고 하거나 별도 워크트리에서.

### T-2. 외부 build가 반복 재발해 dev를 계속 깨뜨릴 때 → distDir 격리
- **증상:** dev를 죽이고 `.next`를 지우고 재시작해도, 외부(예: code-review 워크트리,
  harness 자동화)에서 `npm run build`가 **산발적으로 다시 돌며** `.next`를 production으로
  덮어 dev가 또 404/500(`__webpack_modules__ is not a function`)이 됨.
- **해결(dev를 물리 격리):** `next.config.ts`에 임시로(커밋 금지)
  ```ts
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ```
  를 넣고 dev만 별도 디렉토리로 띄운다:
  ```bash
  NEXT_DIST_DIR=.next-dev npm run dev
  ```
  외부 build는 `.next`, dev는 `.next-dev`를 써서 더 이상 충돌하지 않는다.
- **⚠️ 격리 디렉토리 뒷정리(필수):** `.next-dev`는 `.gitignore`/eslintignore에 없어서
  - `npm run lint`가 `.next-dev/` 안의 Next 생성 코드를 스캔해 **수천 개 가짜 에러**를 냄.
  - Next가 `tsconfig.json`의 `include`에 `.next-dev/types/**`를 자동 추가함.
  테스트 후 반드시 원복: `rm -rf .next-dev && git checkout next.config.ts tsconfig.json`.

---

## 실행 기록 템플릿

매 실행마다 아래를 복사해 결과를 남긴다.

```
일자:
브랜치/커밋:
env 기준선: Supabase=___  Anthropic=___  Polar=___
그룹 A:  S-A1[ ] S-A2[ ] S-A3[ ] S-A4[ ] S-A5[ ] S-A6[ ]
그룹 B:  S-B1[ ] S-B2[ ] S-B3[ ] (S-B4=키전용)
부록 F 적용/원복:  적용[ ] 원복[ ]
발견 이슈:
스크린샷 경로:
```
