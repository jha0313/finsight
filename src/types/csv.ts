import type { Direction } from "./transaction";

export type CanonicalField =
  | "date"
  | "merchant"
  | "amount"
  | "debit"
  | "credit"
  | "currency"
  | "account";

export type CsvMappingSource = "standard" | "fallback";

export interface CsvMapping {
  columns: Record<CanonicalField, string | null>;
  source: CsvMappingSource;
}

export interface ParsedTransaction {
  date: string;
  merchant: string;
  signedAmount: string;
  direction: Direction;
  currency: string;
  account?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  mapping: CsvMapping;
  warnings: string[];
  needsFallback: boolean;
}

// CSV·PDF 등 입력 형식에 무관한 정규화된 명세서 결과. composition root에서
// 형식별 파서가 이 형태로 변환하고, 이후 분석 파이프라인은 입력 출처를
// 신경 쓰지 않는다. sourceText는 statement 중복 판정용 sourceHash의 원본이다.
export interface ParsedStatement {
  transactions: ParsedTransaction[];
  warnings: string[];
  needsFallback: boolean;
  sourceText: string;
}
