# Step 1: sample-demo

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/PRD.md` — "랜딩(샘플 명세서 데모 먼저)" — 첫 방문자가 가입 전에 분석 결과를 체험
- `/docs/ARCHITECTURE.md` — 데이터 흐름, mock-first(테스트 더블/주입)
- `/src/lib/orchestration/index.ts`(phase 1) — `runAnalysis({ csv, tier, deps })` (순수 파이프라인)
- `/src/lib/csv`·`/src/lib/analysis`·`/src/lib/mask`(phase 1) — 파이프라인 구성요소
- `/src/types/ports.ts` — `InsightProvider`(데모용 가짜 구현 주입)
- `/src/types/analysis.ts` — `AnalyzeResponse`·`FreeAnalysis`·`ProInsights`
- `/src/components/*`(phase 2: `CategoryDonut`·`TrendLine`·`AnomalyList`·`InsightsPanel`·`StatCard`) — 데모 렌더에 재사용
- step 0 산출물 `src/app/page.tsx` — 데모 섹션을 삽입할 랜딩

step 0의 랜딩에 **샘플 데모 섹션**을 채운다. 기존 lib 파이프라인과 대시보드 컴포넌트를 **재사용**한다(재구현 금지).

## 작업

키 없이 작동하는 샘플 데모를 만든다. **외부 API·인증·DB 없이** 번들 샘플 CSV를 lib 파이프라인으로 분석해 대시보드 컴포넌트로 렌더한다.

### 구성

1. **샘플 CSV** — 현실적인 한국 카드/은행 명세서 샘플(예: `public/sample-statement.csv` 또는 `src/app/_demo`의 상수). 카테고리가 고루 분포하고, **반복 구독 결제 1건**(이상탐지 시연용)과 환불 1건을 포함한 20~40행.
2. **데모용 InsightProvider** — Claude를 호출하지 않고 **정적 한국어 인사이트**를 반환하는 가짜 구현(`InsightProvider` 포트 충족). 데모 전용 모듈에 둔다.
3. **데모 섹션** — 서버에서 `runAnalysis({ csv: 샘플, tier: 'free', deps: { insightProvider: 데모provider } })`를 실행해 `AnalyzeResponse`를 얻고, phase 2 대시보드 컴포넌트(`CategoryDonut`·`TrendLine`·`AnomalyList`·`InsightsPanel`)로 렌더해 step 0 랜딩의 데모 슬롯에 삽입.
4. 데모 섹션 렌더 테스트(jsdom) 동반.

### 핵심 규칙 (벗어나지 마라)

- **키 0**: 데모는 Supabase/Claude/Polar/인증 없이 동작해야 한다. `runAnalysis`에 **데모용 가짜 InsightProvider**를 주입하라(실제 Claude 어댑터 금지). `build && test`가 키 없이 green.
- **재사용**: lib 파이프라인(`runAnalysis`)과 대시보드 컴포넌트·`lib/format`를 그대로 쓴다. 분석·포맷·차트를 재구현하지 마라.
- **부호/마스킹 정합성**: 샘플 CSV도 실제 파이프라인을 타므로 부호 규약·마스킹이 그대로 적용된다(데모용 우회 금지).
- **시각 규칙**: 토큰만(hex 인라인 금지), 단일 accent, 숫자 mono, 한글 Pretendard, 'Vantage' 노출 금지. 차트는 토큰색.
- **레이어**: 데모 페이지(app)는 `src/lib`·`src/components`·`src/types`를 wiring한다. 데모 provider는 포트를 구현하되 `src/services`를 거치지 않는다(가짜라 네트워크 0).

### 테스트 (네트워크 0)

- 샘플 CSV가 `runAnalysis`를 통과해 `byCategory`·`trend`·`anomalies`(구독 누수 포함)가 생성되는지.
- 데모 섹션이 그 결과로 차트·인사이트를 렌더하는지(jsdom).

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green

# 데모가 실제 lib 파이프라인을 쓰는지 (데모 전용 분석 재구현이 아님)
grep -rIn 'runAnalysis' src/app | head
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 렌더/파이프라인 테스트 선행(TDD)? 키 없이 build/test green인가?
   - 데모가 `runAnalysis` + 기존 컴포넌트를 재사용하는가(재구현 아님)?
   - 가짜 InsightProvider가 주입돼 Claude를 호출하지 않는가?
   - 토큰만·숫자 mono·'Vantage' 없음인가? 샘플에 구독 누수/이상거래가 시연되는가?
3. 결과에 따라 `phases/4-landing/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 샘플 CSV·데모 흐름 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 실제 Claude/Supabase 어댑터를 데모에 쓰지 마라. 이유: 키 없이 작동해야 한다(가짜 InsightProvider 주입).
- 분석·차트·포맷을 데모용으로 재구현하지 마라. 이유: lib 파이프라인·기존 컴포넌트 단일 출처 재사용.
- 부호/마스킹을 데모용으로 우회하지 마라. 이유: 데모도 실제 파이프라인 정합성을 보여야 한다.
- hex 인라인·두 번째 accent·'Vantage' 노출 금지. 이유: 디자인 CRITICAL.
- 결제/대시보드 인증 흐름을 건드리지 마라. 이유: 범위 밖(이미 구현됨).
- 기존 테스트를 깨뜨리지 마라.
