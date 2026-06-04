export type Direction = "debit" | "credit" | "refund";

export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "utilities"
  | "entertainment"
  | "health"
  | "finance"
  | "income"
  | "other";

export interface Transaction {
  date: string;
  merchant: string;
  signedAmount: string;
  direction: Direction;
  category: Category;
  currency: string;
  maskedAccount?: string;
  rowHash: string;
}
