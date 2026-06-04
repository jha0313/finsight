# Step 5: dashboard-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/PRD.md` — 사용자 여정(CSV 업로드 → Free 분석 → Pro 잠금 미리보기), 차트 중심 대시보드
- `/docs/DESIGN.md` — 대시보드 적용(밴드·카드·차트 토큰색), 한국어 우선·차분한 평서체
- `/docs/ARCHITECTURE.md` — 상태 관리(서버=Server Components/Route Handlers, 클라=업로드·차트 인터랙션만 Client)
- `/AGENTS.md` — 컴포넌트 dumb·토큰만·숫자 mono·'Vantage' 금지
- step 3 `src/app/api/analyze/route.ts` — 응답 `AnalyzeResponse`
- step 4 `src/components/*` — `CategoryDonut`·`TrendLine`·`AnomalyList`·`InsightsPanel`·카드
- step 2 `src/middleware.ts` — 보호 경로(대시보드는 인증 필요)
- `/src/types/analysis.ts` — `AnalyzeResponse`

step 4의 dumb 컴포넌트와 step 3의 라우트를 **재사용해 결선만** 한다. 컴포넌트/포매터를 재구현하지 마라.

## 작업

대시보드 페이지와 업로드 흐름을 작성한다. 업로드·차트 인터랙션만 Client Component.

### 구성 (재량, 책임 유지)

- **대시보드 페이지** `src/app/(dashboard)/dashboard/page.tsx`(또는 적절한 세그먼트) — 인증된 사용자용. step 4 컴포넌트로 결과를 렌더.
- **업로드 컴포넌트**(Client) `src/components/UploadPanel.tsx` 등 — CSV 파일 선택 → `POST /api/analyze`(멀티파트/본문) → 응답 `AnalyzeResponse`를 상태로 보관 → 차트·인사이트 렌더. 로딩/에러 상태 표현.
- **Pro 잠금 미리보기** — `pro.status`에 따라 `InsightsPanel`이 active(Opus)/locked(Sonnet 미리보기 + 업그레이드 유도)/unavailable(일시 불가)를 표현. (실제 결제 CTA·체크아웃은 phase 3)
- **랜딩/샘플 데모는 범위 밖**(phase 3) — 이 step은 인증 후 대시보드만.

### 핵심 규칙 (벗어나지 마라)

- **Client는 인터랙션만**: 업로드·차트 상호작용만 Client Component(`useState`). 데이터 페칭/판정은 서버 또는 route. 구독상태를 클라이언트에서 토글하지 마라.
- **dumb 재사용**: step 4 컴포넌트·`lib/format`를 그대로 쓰고, 페이지에서 포맷/계산을 재구현하지 마라.
- **응답 계약 준수**: `AnalyzeResponse`(free 항상 + `pro.status`)를 그대로 렌더. 미구독/실패여도 free를 보여주고 pro는 잠금/불가로 표현(402 가정 금지).
- **시각 규칙**: 토큰만(hex 인라인 금지), 단일 accent, 숫자 mono, 한글 Pretendard, 카드 24px+hairline, 'Vantage' 노출 금지. 카피는 한국어·차분한 평서체(노이모지·노느낌표).
- **레이어**: 페이지/클라 컴포넌트는 `src/components`·`src/lib`·`src/types`·`react`를 쓴다. 업로드는 `fetch('/api/analyze')`로 호출(서버 라우트가 composition root).

### 테스트 (네트워크 0)

- 업로드 컴포넌트의 상태 전이(초기/로딩/결과/에러)를 `@testing-library/react` + `fetch` 목으로 검증.
- 주어진 `AnalyzeResponse`로 대시보드가 차트·인사이트·잠금 상태를 렌더하는지(jsdom). 비-page `.tsx`(클라 컴포넌트)는 테스트 선행.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green (fetch 목)

grep -rIn '#[0-9a-fA-F]\{3,6\}' src/app src/components | grep -v globals.css && echo "FAIL: 인라인 hex" || echo "OK"
! grep -rIn 'Vantage' src/app src/components
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 비-page 클라 컴포넌트 테스트 선행(TDD)? fetch 목으로 네트워크 0인가?
   - 업로드 → `/api/analyze` → 렌더 흐름이 동작하고, 로딩/에러/결과 상태가 있는가?
   - `pro.status`(active/locked/unavailable)가 UI로 표현되는가? free가 항상 보존되는가?
   - 토큰만·숫자 mono·인라인 hex 없음·'Vantage' 없음인가? 컴포넌트/포매터를 재사용했는가?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 대시보드·업로드·잠금 표현 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 구독상태/tier를 클라이언트에서 판정·토글하지 마라. 이유: CRITICAL — 서버 DB 진실원천.
- 컴포넌트·포매터를 재구현하지 마라. 이유: step 4 단일 출처 재사용.
- 미구독을 402로 가정해 차단 UI를 만들지 마라. 이유: 200 + free + pro.status 계약.
- 결제 체크아웃·웹훅·랜딩·샘플 데모를 만들지 마라. 이유: phase 3 범위.
- hex 인라인·두 번째 accent·'Vantage' 노출 금지. 이유: 디자인 CRITICAL.
- 기존 테스트를 깨뜨리지 마라.
