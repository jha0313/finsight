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

export interface AiUsageGateway {
  getCachedInsights(userId: string, inputHash: string): Promise<unknown | null>;
  tryConsumeDailyQuota(userId: string, tier: Tier): Promise<boolean>;
}

export interface CheckoutGateway {
  create(input: {
    customerExternalId: string;
    productId?: string;
  }): Promise<{ url: string }>;
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
