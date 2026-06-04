# Step 1: csv-parse

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-006(표준 파서 우선, 인식 실패 시에만 Claude 폴백, 합계행 필터)
- `/AGENTS.md` — CRITICAL: CSV 컬럼 매핑은 표준 파서 우선, 표준 경로는 LLM 0
- `/src/types/csv.ts` — `CanonicalField`, `CsvMapping`
- `/src/types/transaction.ts` — `Direction`
- `/src/lib/money/*`(step 0) — `parseAmount`·`deriveSignedAmount` (재사용)

step 0의 money 유틸을 반드시 재사용하라(부호/금액 정규화를 재구현하지 마라).

## 작업

`src/lib/csv/`에 **표준 CSV 파서**를 TDD로 작성한다. 1차 커버리지는 **헤더 휴리스틱 제네릭 매핑**(특정 은행 템플릿 하드코딩 아님). 테스트를 먼저 작성하라.

### 타입 추가 (types/csv.ts 확장 — 이 step에서 producer로서 추가 허용)

```ts
// 파싱 산출물(다운스트림에서 category·maskedAccount·rowHash가 채워지기 전 단계)
export interface ParsedTransaction {
  date: string;          // ISO 'YYYY-MM-DD'로 정규화
  merchant: string;
  signedAmount: string;  // step0 deriveSignedAmount 결과
  direction: Direction;
  currency: string;
  account?: string;      // 원시(미마스킹) — step 2에서 마스킹
}
export interface ParseResult {
  transactions: ParsedTransaction[];
  mapping: CsvMapping;
  warnings: string[];
  needsFallback: boolean; // 표준 매핑 실패 → 다음 페이즈에서 Claude 폴백(이 페이즈에선 플래그만)
}
```

### 시그니처 (내부 구현은 재량)

```ts
// 헤더명 휴리스틱으로 canonical 필드 매핑. 한/영 별칭 인식.
// date←날짜/거래일시/일자/거래일, merchant←가맹점/내용/적요/거래처/사용처, amount←금액/거래금액/이용금액,
// debit←출금/출금액/지출, credit←입금/입금액, currency←통화, account←카드번호/계좌번호 등.
export function mapColumns(headers: string[]): CsvMapping;

// 디코드된 CSV 텍스트(또는 Buffer) → ParseResult. 합계/소계 요약행 필터.
export function parseCsv(input: string | Buffer, opts?: { encoding?: string }): ParseResult;
```

### 핵심 규칙 (벗어나지 마라)

- **표준 경로 LLM 0**: 이 step은 Claude를 호출하지 않는다. 매핑 실패 시 `needsFallback: true`만 세우고 끝낸다(실제 폴백은 다음 페이즈).
- **합계/소계 요약행 필터**: "합계/소계/Total/누계" 등 키워드 행, 날짜 없는 집계행을 거래에서 제외하라. 이유: CRITICAL — 합계행이 거래로 섞이면 분석이 2배로 틀어진다.
- **money 재사용**: 금액·부호는 step 0의 `parseAmount`/`deriveSignedAmount`로만 처리하라. 재구현 금지.
- **날짜 정규화**: 다양한 포맷(YYYY.MM.DD, YYYY/MM/DD, MM/DD/YYYY 등)을 ISO `YYYY-MM-DD`로 정규화하라.
- **순수 함수**: `src/lib/csv`는 `src/types`·`src/lib/money`·순수 유틸만 의존. 외부 SDK·`src/services` 금지.
- CSV 토큰화(따옴표·임베디드 콤마)는 직접 구현하지 말고 **순수 파싱 라이브러리**(예: `papaparse` 또는 `csv-parse`)를 써도 된다(네트워크 없는 순수 유틸이므로 허용). 인코딩은 UTF-8(BOM strip) 최소 지원, 한국 사용자 대상이라 CP949/EUC-KR 지원은 권장(예: `iconv-lite`).

### 테스트로 커버할 케이스

단일 금액 컬럼 / 출금·입금 2컬럼 / 헤더 별칭(한·영) / 합계행 필터 / 따옴표·콤마 포함 필드 / BOM / 매핑 실패 시 `needsFallback`.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 테스트 선행(TDD)? 합계/소계행이 필터되는가? money 유틸을 재사용했는가?
   - 매핑 실패 시 `needsFallback`만 세우고 LLM을 호출하지 않는가?
   - `src/lib/csv`가 `src/services`/외부 SDK를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/1-core-loop/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 파서 함수·추가 타입 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 이 step에서 Claude/외부 API를 호출하지 마라. 이유: 표준 경로는 LLM 0이며, 폴백 매핑은 다음 페이즈(services/claude) 범위다.
- 금액/부호 정규화를 재구현하지 마라. 이유: step 0 money 유틸의 단일 출처를 깨면 부호 규약이 어긋난다.
- 마스킹·카테고리 분류·이상탐지를 여기 넣지 마라. 이유: step 2·3 범위.
- 특정 은행 포맷을 하드코딩하지 마라. 이유: 1차 커버리지는 헤더 휴리스틱 제네릭(임의 CSV 호환).
- 기존 테스트를 깨뜨리지 마라.
