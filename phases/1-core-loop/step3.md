# Step 3: analysis

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/PRD.md` — Free 기능 ①카테고리 분류 ②기간 추이 ③구독 누수·이상 거래 탐지(룰베이스)
- `/AGENTS.md` — Free=규칙·통계 분석(LLM 0). 이 step은 순수 룰베이스다.
- `/src/types/analysis.ts` — `FreeAnalysis`(`byCategory`·`trend`·`anomalies`), `CategoryBreakdown`, `TrendPoint`, `Anomaly`
- `/src/types/transaction.ts` — `Transaction`, `Category`, `Direction`
- `/src/lib/money/*`(step 0) — `sumMoney`·`compareMoney` (집계에 재사용)

## 작업

`src/lib/analysis/`에 규칙·통계 분석을 TDD로 작성한다. **LLM 0 — 순수 함수**. 테스트를 먼저 작성하라.

### 시그니처 (내부 구현은 재량)

```ts
// 가맹점명 → 카테고리(룰베이스 키워드 매핑). 미매칭은 'other'.
export function categorize(merchant: string): Category;

// 거래 집합 → Free 분석 결과(규칙·통계).
//  byCategory: 카테고리별 합계·건수 (지출=direction 'debit' 기준 집계)
//  trend: 기간(월)별 합계 추이
//  anomalies: 구독 누수(반복결제) + 이상치(outlier)
export function analyze(transactions: Transaction[]): FreeAnalysis;
```

### 분석 규칙 (의도)

- **byCategory**: `categorize`로 분류 후 카테고리별 `sumMoney`(money 유틸 재사용)·건수. 지출 중심(`direction === 'debit'`)으로 집계하되 환불/입금 처리 방침을 일관되게.
- **trend**: 거래 날짜에서 월(`YYYY-MM`)을 키로 기간별 합계.
- **anomalies**:
  - `subscription_leak`: 같은 가맹점이 **규칙적 간격(월 주기)으로 유사 금액** 반복(≥2~3회). 구독/반복결제 누수 후보.
  - `outlier`: 통계적 이상치(예: 카테고리 또는 전체 대비 비정상적으로 큰 금액 — 중앙값/표준편차 기반 임계).

### 핵심 규칙 (벗어나지 마라)

- **LLM 0 / 순수**: Claude·외부 API를 호출하지 마라. `src/lib/analysis`는 `src/types`·`src/lib/money`·표준 라이브러리만 의존(외부 SDK·`src/services` 금지).
- **금액 집계는 money 유틸**: 합계·비교는 step 0의 `sumMoney`/`compareMoney`로. `parseFloat` 금지(부동소수점 오차 금지).
- **결정론적**: 같은 입력 → 같은 결과(정렬·집계 순서 안정).

### 테스트로 커버할 케이스

카테고리 분류(키워드 매칭·미매칭 'other'), 카테고리별 합계 정확성(money 누적), 월별 trend 그룹핑, 구독 누수 탐지(반복 가맹점·유사 금액), outlier 탐지, 빈 입력 안전 처리.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 합계가 money 유틸로 계산돼 오차가 없는가?
   - 구독 누수·outlier 탐지가 테스트로 검증됐는가?
   - `src/lib/analysis`가 LLM/외부 SDK/`services`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/1-core-loop/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 분석 함수·탐지 규칙 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- Claude/외부 API를 호출하지 마라. 이유: Free 규칙·통계 분석은 LLM 0이다(AI 인사이트는 step 4에서 포트로 주입).
- `parseFloat`로 금액을 합산하지 마라. 이유: CRITICAL float 금지 — money 유틸을 쓴다.
- CSV 파싱·마스킹·오케스트레이션을 여기 넣지 마라. 이유: step 1·2·4 범위.
- 기존 테스트를 깨뜨리지 마라.
