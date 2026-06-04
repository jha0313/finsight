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
