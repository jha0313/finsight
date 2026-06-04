# Step 0: money-normalize

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-006(부호/금액 정규화: 통화기호·콤마·괄호음수 strip, 출금/입금 단일화, `signed_amount` + `direction`)
- `/AGENTS.md` — CRITICAL: "금액은 numeric, float 금지. 지출 양수/환불 음수를 direction으로 단일화"
- `/src/types/transaction.ts` — `Direction`, `Transaction.signedAmount: string`(decimal 문자열)
- `/docs/ARCHITECTURE.md` — mock-first, lib는 types/와 순수 유틸에만 의존

이 step은 핵심 루프에서 **가장 먼저 TDD로** 만든다. 부호/금액이 틀리면 이후 모든 분석이 조용히 반대로 나오기 때문이다.

## 작업

`src/lib/money/`(또는 `src/lib/money.ts`)에 금액 정규화·연산 유틸을 **TDD로** 작성한다. 테스트를 먼저 쓰고(`*.test.ts`) 통과하는 구현을 작성하라(코덱스 TDD 가드가 강제한다).

### 시그니처 (내부 구현은 재량, 아래 계약/규칙은 유지)

```ts
// 원시 금액 토큰 → 정규화된 decimal 문자열. 통화기호·콤마·공백 strip, 괄호=음수, 선/후행 부호 처리.
// 예: "₩1,234" → "1234.00", "(1,234.56)" → "-1234.56", "-1,000" → "-1000.00", "1,234.5" → "1234.50"
export function parseAmount(raw: string): string;

// 출금/입금 2컬럼 또는 단일 금액 컬럼 → 부호 규약으로 단일화.
// 부호 규약: 지출(debit) = 양수, 환불(refund)·입금(credit) = 음수(유입). direction이 debit/credit/refund를 구분.
export function deriveSignedAmount(input: {
  amount?: string;   // 단일 금액 컬럼(부호 포함 가능)
  debit?: string;    // 출금 컬럼
  credit?: string;   // 입금 컬럼
}): { signedAmount: string; direction: Direction };

// decimal 문자열 산술 — 내부는 정수 minor-unit(bigint)으로 계산. float/parseFloat 금지.
export function addMoney(a: string, b: string): string;
export function sumMoney(values: string[]): string;
export function negateMoney(a: string): string;
export function compareMoney(a: string, b: string): -1 | 0 | 1;
```

### 핵심 규칙 (벗어나지 마라)

- **float 금지.** `parseFloat`/`Number()`로 금액을 연산하지 마라. 내부적으로 **정수 minor-unit(예: 센트, `bigint`)**으로 변환해 계산하고 decimal 문자열로 되돌려라. 이유: CRITICAL — 부동소수점 오차가 합계를 틀리게 한다.
- **부호 규약 단일화**: 지출=양수, 환불/입금=음수(유입). `direction`이 `debit|credit|refund`를 구분한다. 괄호 `(1,234)`는 음수.
- **순수 함수**: `src/lib/money`는 `src/types`와 표준 라이브러리만 쓴다. 외부 SDK·`src/services` import 금지(ESLint 가드가 강제).
- 소수 자릿수는 `numeric(14,2)`에 맞춰 **2자리로 정규화**(반올림 규칙은 일관되게, 예: 은행 반올림 불필요—단순 2dp).

### 테스트로 반드시 커버할 케이스

통화기호(₩/$/￦/원), 천단위 콤마, 괄호 음수, 선/후행 `-`, 소수 0/1/2자리, 빈/공백 입력, 출금만/입금만/양쪽, `addMoney`/`sumMoney` 누적 오차 없음(예: `0.1 + 0.2 = 0.30`).

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # money TDD 테스트 통과 + 기존 green 유지
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트를 먼저 작성했는가(TDD)? float/`parseFloat`를 금액 연산에 쓰지 않았는가?
   - 부호 규약(지출 양수/환불·입금 음수)과 괄호 음수가 테스트로 검증됐는가?
   - `src/lib/money`가 외부 SDK/`services`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/1-core-loop/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 함수·파일 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `parseFloat`/`Number()`로 금액을 연산하지 마라. 이유: CRITICAL float 금지 — 합계가 틀어진다.
- `src/lib/money`에서 외부 SDK나 `src/services`를 import하지 마라. 이유: 레이어 단방향 의존(mock-first).
- CSV 파싱·마스킹·분석 로직을 여기 넣지 마라. 이유: 각각 step 1·2·3 범위.
- 테스트 없이 구현부터 작성하지 마라. 이유: TDD 가드가 차단하며, 부호 로직은 테스트 선행이 필수다.
- 기존 테스트를 깨뜨리지 마라.
