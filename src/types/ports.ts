import type { ProInsights } from "./analysis";
import type { StatementStatus } from "./statement";
import type { Tier } from "./tier";
import type { Transaction } from "./transaction";

export interface InsightProvider {
  generate(input: {
    transactions: Transaction[];
    tier: Tier;
  }): Promise<ProInsights>;
}

export interface SubscriptionGateway {
  resolveTier(userId: string): Promise<Tier>;
}

export interface StatementRepository {
  saveStatementAnalysis(
    input: SaveStatementAnalysisInput,
  ): Promise<{ statementId: string }>;
}

export interface SaveStatementAnalysisInput {
  userId: string;
  statement: {
    sourceHash: string;
    status: StatementStatus;
  };
  transactions: Transaction[];
  analysis?: {
    inputHash: string;
    model: string;
    result: unknown;
  };
}
