# Step 4: orchestration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 흐름(파싱→마스킹→분석→AI 인사이트→응답), "composition root는 route handler(얇은 와이어링), 분기·에러매핑은 lib/orchestration"
- `/docs/ADR.md` — ADR-003(포트/어댑터·의존성 주입·테스트 더블), ADR-004(AI 인사이트 timeout 30s, 실패 시 규칙·통계 보존 + AI `unavailable` 격리)
- `/AGENTS.md` — CRITICAL: 미구독/쿼터소진/실패 시에도 200 + Free 결과 + `pro.status=locked|unavailable`. 402 아님.
- `/src/types/ports.ts` — `InsightProvider`(주입), `SubscriptionGateway`
- `/src/types/analysis.ts` — `AnalyzeResponse`, `FreeAnalysis`, `ProInsights`
- `/src/types/tier.ts` — `Tier`, `ProStatus`
- `/src/lib/money/*`·`/src/lib/csv/*`·`/src/lib/mask/*`·`/src/lib/analysis/*` (step 0~3 — 결선 대상)

## 작업

`src/lib/orchestration/`에 핵심 루프를 **결선**하는 오케스트레이터를 TDD로 작성한다. **포트에만 의존하고 어댑터는 주입받는다**(실제 Claude/Supabase 어댑터는 다음 페이즈). 테스트는 `FakeInsightProvider` 같은 테스트 더블로 네트워크 0. 테스트를 먼저 작성하라.

### 응답 계약 (이 step에서 확정 — 반드시 따르라)

PRD(Free도 Sonnet AI 요약)와 ARCHITECTURE(`pro:{status,insights?}`)를 화해시킨 계약:

- AI 인사이트는 **tier로 모델만 라우팅**(Free=Sonnet/Pro=Opus, 라우팅은 어댑터 책임)되어 `AnalyzeResponse.pro.insights`에 담긴다.
- `pro.status`(`ProStatus`)는 게이팅/가용 상태를 표현한다:
  - `'active'` — tier='pro' + 인사이트 성공(Opus 심층)
  - `'locked'` — tier='free' + 인사이트 성공(Sonnet 요약 = 무료 미리보기, Opus 심층은 잠금)
  - `'unavailable'` — 인사이트 호출 실패/타임아웃(규칙·통계는 보존)
- 어떤 경우에도 `free`(규칙·통계)는 보존된다. 예외를 던져 200을 깨지 마라.

### 시그니처 (내부 구현은 재량)

```ts
export interface AnalyzeDeps {
  insightProvider: InsightProvider;  // 주입(테스트는 fake, 실제는 다음 페이즈 services/claude)
  aiTimeoutMs?: number;              // 기본 30000 (ADR-004)
}

export async function runAnalysis(input: {
  csv: string | Buffer;
  tier: Tier;
  deps: AnalyzeDeps;
}): Promise<{
  response: AnalyzeResponse;
  transactions: Transaction[];   // 마스킹·카테고리·rowHash 채워진 최종형(다음 페이즈 저장용)
  sourceHash: string;
  needsFallback: boolean;        // 표준 매핑 실패 시 — 라우트가 사용자 확인 흐름으로
}>;
```

### 결선 순서 (의도)

1. `csv.parseCsv` → `ParsedTransaction[]` + mapping + `needsFallback`.
2. 각 행을 최종 `Transaction`으로 조립: `category = analysis.categorize(merchant)`, `maskedAccount = mask.maskAccount(account)`(있을 때), `rowHash = mask.rowHash(parsed)`. `sourceHash = mask.sourceHash(...)`.
3. `analysis.analyze(transactions)` → `FreeAnalysis`(규칙·통계, 항상 수행).
4. AI 인사이트: `deps.insightProvider.generate({ transactions, tier })`를 **timeout(기본 30s)**으로 감싸 호출.
   - 성공 → `pro.insights` 채우고 `pro.status` = (tier==='pro' ? 'active' : 'locked').
   - 실패/타임아웃 → `pro.status='unavailable'`, `pro.insights` 생략. **free는 그대로 보존**(에러를 전파하지 마라).
5. `AnalyzeResponse { tier, free, pro, warnings }` 조립해 반환.

### 핵심 규칙 (벗어나지 마라)

- **포트 의존만**: `src/lib/orchestration`은 `src/services`·외부 SDK(`@anthropic-ai/sdk`·`@supabase/*`·`@polar-sh/*`)를 import하지 마라. `InsightProvider`는 **인자로 주입**받는다(ESLint 가드가 강제). 이유: mock-first — 키 없이 테스트 green.
- **AI 격리**: insightProvider 실패/타임아웃이 전체를 깨면 안 된다. 규칙·통계(`free`)는 항상 보존하고 AI만 `unavailable`로 격리하라.
- **200 보존**: 미구독/실패는 예외가 아니라 `pro.status`로 표현한다. `runAnalysis`는 정상 입력에서 throw하지 않는다(파싱 자체가 불가능한 치명 입력만 예외 허용).
- **tier 신뢰 경계**: `tier`는 인자로 받되, 실제 판정은 다음 페이즈 라우트가 `SubscriptionGateway`(서버 DB)로 한다. 이 step은 주어진 tier로 동작만 한다(요청 본문 tier를 신뢰하는 코드를 만들지 마라).

### 테스트로 커버할 케이스

정상 흐름(free/pro 각각 pro.status='locked'/'active'), insightProvider가 throw/지연(타임아웃) → `unavailable` + free 보존, `needsFallback` 전파, 빈/소량 거래, 주입된 fake로 네트워크 0.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? `FakeInsightProvider` 등 더블로 네트워크 0인가?
   - AI 실패/타임아웃 시 free가 보존되고 `pro.status='unavailable'`인가?
   - `pro.status` 계약(active/locked/unavailable)이 tier·성공 여부대로 동작하는가?
   - `src/lib/orchestration`이 `services`/외부 SDK를 import하지 않고 포트를 주입받는가(ESLint green)?
3. 결과에 따라 `phases/1-core-loop/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 runAnalysis 결선·응답 계약 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `src/services`나 외부 SDK를 import하지 마라. 이유: 레이어 단방향 — 어댑터는 다음 페이즈에서 route가 주입한다. 지금 import하면 mock-first가 깨진다.
- AI 실패 시 예외를 던져 200/free를 깨지 마라. 이유: CRITICAL — 규칙·통계는 보존하고 AI만 격리한다.
- 요청 본문/헤더의 tier를 신뢰하는 판정 로직을 만들지 마라. 이유: Pro 게이팅은 다음 페이즈에서 서버 DB로만 판정한다.
- 실제 Claude/Supabase 어댑터, `/api/analyze` 라우트, UI를 만들지 마라. 이유: 다음 페이즈(2-api-dashboard) 범위.
- 기존 테스트를 깨뜨리지 마라.
