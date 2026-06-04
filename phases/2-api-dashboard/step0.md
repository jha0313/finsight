# Step 0: claude-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-004(structured outputs: `messages.parse` + `output_config.format` + `zodOutputFormat()` → 검증된 `parsed_output`; 티어별 모델 라우팅; 마스킹 거래단위; timeout 30s; 실패 시 격리)
- `/AGENTS.md` — CRITICAL: 외부 클라이언트는 호출 시점 지연 생성. Claude에는 마스킹된 거래단위(가맹점명·금액·날짜·카테고리)만. 전체 식별자 절대 외부 미전송. 대용량은 행 상한/요약.
- `/docs/ARCHITECTURE.md` — `services/`는 `lib/`를 import하지 않고 `types/`만 안다(순환 방지)
- `/src/types/ports.ts` — `InsightProvider`(이 어댑터가 구현)
- `/src/types/analysis.ts` — `ProInsights`(출력 스키마)
- `/src/types/transaction.ts` — `Transaction`, `/src/types/tier.ts` — `Tier`

## 작업

`src/services/claude/`에 `InsightProvider` 구현을 **TDD로** 작성한다(테스트 먼저). 의존성 설치 필요: `@anthropic-ai/sdk`, `zod`.

### 시그니처 (내부 구현은 재량)

```ts
// InsightProvider 구현. 팩토리(주입용) + 클래스/함수 형태 재량.
export function createClaudeInsightProvider(): InsightProvider;
```

### 핵심 규칙 (벗어나지 마라)

- **지연 생성(lazy)**: `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`를 **모듈 import 시점이 아니라 `generate()` 호출 시점**에 만들어라. 이유: CRITICAL — import 시 env를 읽어 throw하면 키 없는 build/test가 깨진다.
- **티어별 모델 라우팅**: `tier === 'pro'` → `claude-opus-4-8`, `tier === 'free'` → `claude-sonnet-4-6`.
- **structured outputs**: `messages.parse` + `output_config.format` + `zodOutputFormat(ProInsightsSchema)`로 검증된 `parsed_output`을 받아 `ProInsights`로 반환. Zod `.min/.max`는 미지원이므로 범위 검증은 후처리. (스키마는 zod로 `ProInsights` 형태를 정의)
- **마스킹 거래단위만 전송**: Claude 프롬프트에 넣는 거래 데이터는 **가맹점명·금액·날짜·카테고리만** 포함하라. `maskedAccount`를 포함한 식별자류는 **넣지 마라**(전체는 물론, 마스킹 값도 불필요하면 제외). 전체 식별자는 절대 외부로 내보내지 마라.
- **토큰 방어**: 대용량 입력은 **행 상한 또는 요약**으로 줄여라(예: 상위 N행/집계). 무한정 전송 금지.
- **timeout + 실패 격리**: SDK 호출에 timeout(예: 30s)을 두고, 실패/초과 시 **throw**하라(상위 `lib/orchestration`이 catch해 `pro.status='unavailable'`로 격리한다). 어댑터가 규칙·통계를 건드리지 않는다.
- **레이어**: `src/services/claude`는 `src/types`와 외부 SDK(`@anthropic-ai/sdk`·`zod`)만 import한다. `src/lib`·`src/app`을 import하지 마라(ESLint 가드).

### 테스트 (네트워크 0)

- `@anthropic-ai/sdk`를 **목으로 대체**(vitest mock)해 실제 호출 없이 검증.
- tier='pro' → opus 모델, tier='free' → sonnet 모델로 호출되는지.
- Claude에 전달되는 페이로드에 **전체/마스킹 식별자가 없고** 가맹점·금액·날짜·카테고리만 있는지.
- 호출 실패/타임아웃 시 throw하는지.

## Acceptance Criteria

```bash
npm install
npm run lint && npm run build && npm test   # 키 없이 green (lazy init)
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? `@anthropic-ai/sdk`가 목으로 대체돼 네트워크 0인가?
   - 클라이언트가 호출 시점에 지연 생성되는가(import 시 env throw 없음 → 키 없이 build green)?
   - tier→모델 라우팅, 마스킹 거래단위 전송, timeout/throw가 테스트로 검증됐는가?
   - `src/services/claude`가 `src/lib`/`src/app`을 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/2-api-dashboard/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 어댑터·스키마·라우팅 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요(예: 키 없이는 불가한 작업) → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 모듈 import 시점에 `process.env.ANTHROPIC_API_KEY`를 읽어 throw하지 마라. 이유: CRITICAL — 키 없는 build/test가 깨진다(mock-first).
- Claude에 전체/불필요한 식별자를 전송하지 마라. 이유: CRITICAL — 제3자 PII 노출 차단.
- `src/services/claude`에서 `src/lib`나 `src/app`을 import하지 마라. 이유: services는 types만 안다(순환 방지).
- Supabase/Polar/route/UI를 건드리지 마라. 이유: 각각 다음 step 범위.
- 실제 Claude API를 호출하는 테스트를 작성하지 마라. 이유: 네트워크 0 — 목으로 검증한다.
- 기존 테스트를 깨뜨리지 마라.
