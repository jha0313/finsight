# Step 3: analyze-route

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 흐름 + "composition root는 route handler(얇은 와이어링), 분기·에러매핑은 lib/orchestration"
- `/docs/ADR.md` — ADR-002(동기 처리·RPC·maxDuration 상향), ADR-004(AI timeout·격리)
- `/AGENTS.md` — CRITICAL: 게이팅은 서버 DB로만. 미구독/쿼터소진 시 402 아니라 **200 + Free 결과 + `pro.status=locked|unavailable`**. RPC 단일 트랜잭션 저장. `analyses` 캐시·`ai_usage_daily` quota. Vercel `maxDuration` 상향.
- `/src/lib/orchestration/*`(phase 1) — `runAnalysis({ csv, tier, deps })`
- `/src/services/claude/*`(step 0) — `createClaudeInsightProvider`
- `/src/services/supabase/*`(step 1) — `getCurrentUser`·`createStatementRepository`·`createSubscriptionGateway`·`createAiUsage`

## 작업

`src/app/api/analyze/route.ts`(POST)를 composition root로 작성한다. **얇은 와이어링** + 분기는 테스트 가능한 함수로 분리해 TDD한다(TDD 가드가 `route.ts`에 테스트를 요구).

### 책임 (흐름)

1. `getCurrentUser()` → 미인증이면 **401**. (인증은 앱 사용 전제 — 미구독과는 다름)
2. 업로드된 CSV(멀티파트/본문) 수신.
3. `tier = subscriptionGateway.resolveTier(userId)` — **서버 DB로만**. 요청 본문 tier 신뢰 금지.
4. (선택) `analyses` 캐시 조회(`getCachedInsights(userId, inputHash)`) — 히트 시 재호출 skip.
5. AI 쿼터: `tryConsumeDailyQuota(userId, tier)` — 한도 초과면 AI를 건너뛰고 `pro.status='unavailable'`(규칙·통계는 보존).
6. 쿼터 OK & 캐시 미스면 `runAnalysis({ csv, tier, deps: { insightProvider: createClaudeInsightProvider() } })`로 분석.
7. `statementRepository.saveStatementAnalysis(...)`로 **RPC 단일 트랜잭션** 저장(중간 실패 시 전체 rollback).
8. **200 + `AnalyzeResponse`** 반환(미구독/쿼터소진/AI 실패여도 200 + free + `pro.status`).
9. 파일 상단에 `export const maxDuration = 60;`(opus latency 대비 상향).

### 핵심 규칙 (벗어나지 마라)

- **402 금지**: 미구독·쿼터소진·AI 실패는 **200 + free + `pro.status`(locked/unavailable)**로 표현하라. 4xx로 막지 마라(미인증 401만 예외).
- **게이팅 DB로만**: tier는 `subscriptionGateway`(DB)로만. 요청 본문/헤더 tier를 읽어 신뢰하지 마라.
- **지연 생성 주입**: 어댑터(claude/supabase)는 **route(composition root)에서 호출 시점 생성**해 `runAnalysis`에 주입하라. `lib/orchestration`은 어댑터를 모른다.
- **RPC 저장**: 저장은 `saveStatementAnalysis`(RPC) 단일 호출. 다중 insert 분해 금지.
- **AI 격리 유지**: orchestration이 이미 timeout/격리하므로 route는 그 결과(`pro.status`)를 그대로 반영하라.
- **테스트 가능**: 핵심 분기(미인증 401, 미구독→locked, 쿼터소진→unavailable, 정상→active/locked)를 목 어댑터로 TDD하라. route.ts는 그 함수를 호출하는 얇은 wiring으로.

### 테스트 (네트워크 0)

목 `getCurrentUser`/gateway/repository/insightProvider로:
- 미인증 → 401.
- free 사용자 정상 → 200, `pro.status='locked'`, free 보존.
- pro 사용자 정상 → 200, `pro.status='active'`.
- 쿼터소진 → 200, `pro.status='unavailable'`, free 보존, Claude 미호출.
- 저장이 RPC 단일 호출로 일어나는지.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 목 어댑터로 네트워크 0인가?
   - 미구독/쿼터소진/AI 실패가 **200 + pro.status**인가(402 아님)?
   - tier가 DB(gateway)로만 판정되는가? 저장이 RPC 단일 호출인가?
   - `maxDuration` 상향이 있는가? 어댑터가 route에서 주입되는가?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 라우트 흐름·게이팅·저장 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 미구독/쿼터소진에 402나 다른 4xx를 반환하지 마라. 이유: CRITICAL — 200 + free + pro.status.
- 요청 본문/헤더의 tier를 신뢰하지 마라. 이유: CRITICAL — 서버 DB 구독상태로만.
- 저장을 다중 insert로 분해하지 마라. 이유: CRITICAL — RPC 단일 트랜잭션.
- `lib/orchestration`에 services/어댑터를 주입하는 것 외에, route에서 분석 파이프라인을 재구현하지 마라. 이유: 단일 출처(orchestration).
- 대시보드 UI를 만들지 마라. 이유: step 4·5 범위.
- 기존 테스트를 깨뜨리지 마라.
