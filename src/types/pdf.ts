import type { Direction } from "./transaction";

// Claude PDF 추출 어댑터의 출력 계약. amount는 부호 없는 절대 금액(통화기호·
// 콤마 포함 가능)이고, 부호는 direction으로만 표현한다. signedAmount 부호
// 적용은 money 모듈로 결정론적으로 수행한다(추출과 부호 규약을 분리).
export interface ExtractedTransaction {
  date: string;
  merchant: string;
  amount: string;
  direction: Direction;
  currency: string;
}
