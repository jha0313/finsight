# Step 2: masking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-009(식별자 마스킹 우선, 전체 PAN 미보관, dedup hash는 정규화 평문 기준 별도 컬럼)
- `/AGENTS.md` — CRITICAL: "직접 식별자는 적재 시 마스킹, 전체값 평문 저장 금지. dedup hash는 정규화 평문 기준"
- `/src/types/transaction.ts` — `Transaction`(`maskedAccount?`, `rowHash`)
- `/src/types/csv.ts` — `ParsedTransaction`(step 1에서 추가됨, 원시 `account` 포함)
- `/docs/ARCHITECTURE.md` — DB 스키마(`source_hash` = statement 단위, `row_hash` = 거래 단위)

## 작업

`src/lib/mask/`에 마스킹·해시 유틸을 TDD로 작성한다. 테스트를 먼저 작성하라.

### 시그니처 (내부 구현은 재량)

```ts
// 카드/계좌번호 등 직접 식별자를 마스킹. 전체값을 반환/보관하지 않는다. 예: "1234-5678-9012-3456" → "**** **** **** 3456"
export function maskAccount(raw: string): string;

// 거래 단위 dedup 해시 — 정규화된 '평문' 기준(마스킹 전 값 사용). 같은 거래는 항상 같은 해시.
// 구성 예: date + merchant(정규화) + signedAmount + 원시 account 정규화.
export function rowHash(t: ParsedTransaction): string;

// statement 단위 dedup 해시 — 원본 파일 내용 또는 거래 집합의 정규화 기준.
export function sourceHash(input: string | ParsedTransaction[]): string;
```

### 핵심 규칙 (벗어나지 마라)

- **전체값 미보관**: `maskAccount`는 전체 카드/계좌번호를 반환하지 않는다(마지막 4자리 등 일부만 노출). 이유: CRITICAL — 전체 PAN을 평문으로 두지 않는다.
- **dedup hash는 정규화 '평문' 기준**: `rowHash`/`sourceHash`는 마스킹된 값이 아니라 **정규화된 원시 값**으로 계산한다. 이유: 마스킹 후 해시하면 서로 다른 카드가 충돌하거나 dedup이 깨진다. 해시는 마스킹과 독립된 별도 컬럼(`row_hash`/`source_hash`)에 들어간다.
- **결정론적**: 같은 입력 → 같은 해시(정규화: 공백/대소문자/포맷 흔들림 흡수). 해시는 `node:crypto`(sha256 등) 사용 가능(표준 라이브러리, 외부 SDK 아님).
- **순수 함수**: `src/lib/mask`는 `src/types`·표준 라이브러리만 의존. 외부 SDK·`src/services` 금지.

### 테스트로 커버할 케이스

다양한 식별자 포맷 마스킹(전체값 미노출 단언), 같은 거래 → 동일 `rowHash`, 포맷만 다른 동일 거래 → 동일 해시(정규화), 마스킹 값과 해시가 독립(마스킹 전 값으로 해시).

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? `maskAccount`가 전체값을 절대 반환하지 않음을 테스트가 단언하는가?
   - `rowHash`/`sourceHash`가 마스킹 전 정규화 평문 기준이고 결정론적인가?
   - `src/lib/mask`가 외부 SDK/`services`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/1-core-loop/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 마스킹·해시 함수 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `maskAccount`가 전체 식별자를 반환하거나 어딘가에 평문으로 남기지 마라. 이유: CRITICAL — 전체 PAN 미보관.
- 해시를 마스킹된 값으로 계산하지 마라. 이유: dedup이 깨지거나 충돌한다(정규화 평문 기준이어야 함).
- 카테고리 분류·이상탐지·오케스트레이션을 여기 넣지 마라. 이유: step 3·4 범위.
- 기존 테스트를 깨뜨리지 마라.
