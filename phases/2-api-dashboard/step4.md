# Step 4: ui-kit

## 읽어야 할 파일

먼저 아래 파일들을 읽고 시각·아키텍처 규칙을 파악하라:

- `/docs/DESIGN.md` — 토큰·폰트·대시보드 적용 규칙(차트 토큰색·숫자 mono·카드 24px radius+hairline)
- `/.claude/skills/vantage-design/README.md`·`colors_and_type.css` — 핵심 5규칙, 시맨틱 타입 클래스
- `/AGENTS.md` — CRITICAL: 컴포넌트는 props만 받는 dumb. 계산·포맷·마스킹은 `lib/`로 분리. 색은 토큰만(hex 인라인 금지), 단일 accent, 숫자 mono, 한글 Pretendard, 화면에 'Vantage' 금지.
- `/src/app/globals.css`(phase 0) — 통합된 토큰·`.num`·시맨틱 타입 클래스
- `/src/types/analysis.ts` — `AnalyzeResponse`·`FreeAnalysis`·`CategoryBreakdown`·`TrendPoint`·`Anomaly`·`ProInsights`(컴포넌트 props 형태)
- `/src/types/transaction.ts`·`/src/types/tier.ts` — `Category`·`Direction`·`ProStatus`

## 작업

대시보드용 **포매터(lib)** 와 **dumb 프레젠테이션 컴포넌트**를 작성한다. 이 step은 페이지 결선·업로드·API 호출을 하지 않는다(step 5). 의존성: 컴포넌트 테스트용 `jsdom`·`@testing-library/react`·`@testing-library/jest-dom`(devDeps), 아이콘 `lucide-react`.

### 4-1. 포매터 (lib, TDD 먼저)

`src/lib/format/`에 순수 포매터를 TDD로 작성:

```ts
export function formatMoney(decimal: string, currency?: string): string; // 천단위·통화·2dp (lib/money 재사용 가능)
export function formatPercent(part: string, total: string): string;
export function formatDate(iso: string): string;
export function directionColorClass(direction: Direction): string;        // debit/refund/credit → semantic 텍스트색 클래스(.num.up/.down 등)
```

### 4-2. 테스트 인프라

- `vitest.config.ts`에 컴포넌트 테스트용 환경 추가(`jsdom`). 기존 node 테스트는 유지(파일별 environment 또는 분리 설정 재량).
- `@testing-library/react`로 렌더 스모크 테스트.

### 4-3. dumb 컴포넌트 (`src/components/`, props만)

각 컴포넌트는 props만 받고 토큰 클래스만 적용한다. 권장 목록:

- `CategoryDonut`(props: `CategoryBreakdown[]`) — 카테고리 도넛. ink/그레이 + accent 1포인트.
- `TrendLine`(props: `TrendPoint[]`) — 기간 추이 라인. 색 `--primary`.
- `AnomalyList`(props: `Anomaly[]`) — 이상거래/구독누수 강조. 강조색 `--semantic-down`.
- `InsightsPanel`(props: `{ status: ProStatus; insights?: ProInsights }`) — AI 인사이트 + Pro 잠금 상태 표현.
- `StatCard`/`AnalysisSummary` 등 카드 — 흰 fill + 1px hairline + 24px radius + 32px 패딩.

각 컴포넌트에 렌더 스모크 테스트(`*.test.tsx`)를 **먼저** 작성한다(주어진 props로 크래시 없이 렌더 + 핵심 텍스트/요소 단언).

### 핵심 규칙 (벗어나지 마라)

- **dumb 컴포넌트**: 컴포넌트는 props만 받는다. 금액·%·날짜 포맷, 부호→색 매핑은 `lib/format`(또는 `lib/money`)으로 분리하고 컴포넌트에서 재계산하지 마라.
- **색은 토큰만**: hex를 인라인하지 마라. 차트색은 토큰(`--primary`·`--semantic-up/down`·ink/그레이). 트레이딩 그린/레드는 **텍스트 색으로만**, 배경 fill 금지.
- **숫자는 mono**: 모든 금액·%·날짜는 `.num`(JetBrains Mono tabular).
- **단일 accent**: `--primary` 외 두 번째 브랜드색 도입 금지. `--accent-yellow`를 브랜드 accent로 쓰지 마라.
- **한글 Pretendard**, 카드 24px radius + hairline, **'Vantage' 텍스트 노출 금지**.
- **레이어**: 컴포넌트는 `src/types`·`src/lib`(포매터)·`react`·`lucide-react`만 의존. `src/services`·외부 데이터 SDK import 금지.

### 차트 구현 메모

차트는 토큰색 제어와 jsdom 테스트 용이성을 위해 **직접 SVG로 그리거나** jsdom 친화적 경량 방식을 택하라(무거운 차트 라이브러리는 토큰색 통제·테스트가 어려우면 피한다). 차트 위 숫자는 전부 mono.

## Acceptance Criteria

```bash
npm install
npm run lint && npm run build && npm test   # 포매터 + 컴포넌트 렌더 테스트 green

grep -rIn '#[0-9a-fA-F]\{3,6\}' src/components && echo "FAIL: 컴포넌트 인라인 hex" || echo "OK: 인라인 hex 없음"
! grep -rIn 'Vantage' src/components
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 포매터 TDD 선행? 컴포넌트 렌더 테스트가 props로 동작하는가(jsdom)?
   - 컴포넌트가 dumb(props만)이고 포맷 로직을 `lib`로 분리했는가?
   - 색이 토큰만이고 인라인 hex·두 번째 accent·'Vantage' 노출이 없는가? 숫자가 mono인가?
   - 컴포넌트가 `src/services`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 포매터·컴포넌트·테스트 인프라 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 컴포넌트에 포맷·계산 로직을 넣지 마라. 이유: CRITICAL — dumb 컴포넌트, 로직은 lib.
- hex를 인라인하거나 두 번째 accent색을 쓰지 마라. 이유: CRITICAL — 토큰만, 단일 accent.
- 트레이딩 그린/레드를 배경 fill로 쓰지 마라. 이유: 텍스트 색으로만(Vantage 규칙).
- 페이지 결선·업로드·`fetch('/api/analyze')`를 하지 마라. 이유: step 5 범위.
- `src/services`나 외부 데이터 SDK를 컴포넌트에서 import하지 마라. 이유: dumb 컴포넌트는 props만.
- 화면에 'Vantage'를 노출하지 마라. 이유: 제품명은 finsight.
- 기존 테스트를 깨뜨리지 마라.
