export type StatementStatus = "ready" | "failed";

export interface Statement {
  id: string;
  userId: string;
  status: StatementStatus;
  sourceHash: string;
  createdAt: string;
}
