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
