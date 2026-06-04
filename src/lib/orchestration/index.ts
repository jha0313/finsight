import { createHash } from "node:crypto";

import { analyze, categorize } from "@/lib/analysis";
import { parseCsv } from "@/lib/csv";
import { maskAccount, rowHash, sourceHash } from "@/lib/mask";
import type { AnalyzeResponse, ProInsights } from "@/types/analysis";
import type { ParsedTransaction } from "@/types/csv";
import type {
  AiUsageGateway,
  InsightProvider,
  StatementRepository,
  SubscriptionGateway,
} from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

const DEFAULT_AI_TIMEOUT_MS = 30000;
const AI_PROMPT_VERSION = "claude-insights:v1";
const MODEL_BY_TIER: Record<Tier, string> = {
  free: "claude-sonnet-4-6",
  pro: "claude-opus-4-8",
};
type RunAnalysisResult = Awaited<ReturnType<typeof runAnalysis>>;

export interface AnalyzeDeps {
  insightProvider?: InsightProvider;
  aiTimeoutMs?: number;
  cachedInsights?: ProInsights;
  skipInsights?: boolean;
}

export interface AnalyzeRequestDeps {
  getCurrentUser: () => Promise<{ id: string } | null>;
  subscriptionGateway: SubscriptionGateway;
  aiUsage: AiUsageGateway;
  statementRepository: StatementRepository;
  insightProviderFactory: () => InsightProvider;
}

export async function runAnalysis(input: {
  csv: string | Buffer;
  tier: Tier;
  deps: AnalyzeDeps;
}): Promise<{
  response: AnalyzeResponse;
  transactions: Transaction[];
  sourceHash: string;
  needsFallback: boolean;
}> {
  const parsed = parseCsv(input.csv);
  const transactions = parsed.transactions.map(toTransaction);
  const free = analyze(transactions);
  const source = sourceHash(csvSourceText(input.csv));
  const warnings = parsed.warnings.length > 0 ? parsed.warnings : undefined;
  const response: AnalyzeResponse = {
    tier: input.tier,
    free,
    pro: {
      status: "unavailable",
    },
    warnings,
  };

  if (parsed.needsFallback) {
    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: parsed.needsFallback,
    };
  }

  if (input.deps.cachedInsights !== undefined) {
    response.pro = {
      status: proStatusForTier(input.tier),
      insights: input.deps.cachedInsights,
    };

    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: parsed.needsFallback,
    };
  }

  if (
    input.deps.skipInsights === true ||
    input.deps.insightProvider === undefined
  ) {
    return {
      response,
      transactions,
      sourceHash: source,
      needsFallback: parsed.needsFallback,
    };
  }

  const insights = await generateInsights({
    insightProvider: input.deps.insightProvider,
    transactions,
    tier: input.tier,
    timeoutMs: input.deps.aiTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
  });

  if (insights !== null) {
    response.pro = {
      status: proStatusForTier(input.tier),
      insights,
    };
  }

  return {
    response,
    transactions,
    sourceHash: source,
    needsFallback: parsed.needsFallback,
  };
}

export async function runAnalyzeRequest(input: {
  csv: string | Buffer;
  deps: AnalyzeRequestDeps;
}): Promise<
  | { status: 200; body: AnalyzeResponse }
  | { status: 401; body: { error: "unauthorized" } }
> {
  const user = await input.deps.getCurrentUser();

  if (user === null) {
    return {
      status: 401,
      body: { error: "unauthorized" },
    };
  }

  const tier = await input.deps.subscriptionGateway.resolveTier(user.id);
  const inputHash = analysisInputHash({
    csv: input.csv,
    tier,
  });
  const cachedInsights = toCachedInsights(
    await input.deps.aiUsage.getCachedInsights(user.id, inputHash),
  );
  const analysisResult =
    cachedInsights === null
      ? await runAnalysisWithoutCache({
          csv: input.csv,
          deps: input.deps,
          tier,
          userId: user.id,
        })
      : await runAnalysis({
          csv: input.csv,
          tier,
          deps: {
            cachedInsights,
          },
        });

  await input.deps.statementRepository.saveStatementAnalysis({
    userId: user.id,
    statement: {
      sourceHash: analysisResult.sourceHash,
      status: analysisResult.needsFallback ? "failed" : "ready",
    },
    transactions: analysisResult.transactions,
    analysis: toStoredAnalysis({
      inputHash,
      response: analysisResult.response,
      tier,
    }),
  });

  return {
    status: 200,
    body: analysisResult.response,
  };
}

async function runAnalysisWithoutCache(input: {
  csv: string | Buffer;
  tier: Tier;
  userId: string;
  deps: AnalyzeRequestDeps;
}): Promise<RunAnalysisResult> {
  const quotaOk = await input.deps.aiUsage.tryConsumeDailyQuota(
    input.userId,
    input.tier,
  );

  return runAnalysis({
    csv: input.csv,
    tier: input.tier,
    deps: quotaOk
      ? {
          insightProvider: createLazyInsightProvider(
            input.deps.insightProviderFactory,
          ),
        }
      : {
          skipInsights: true,
        },
  });
}

function createLazyInsightProvider(
  insightProviderFactory: () => InsightProvider,
): InsightProvider {
  let provider: InsightProvider | null = null;

  return {
    generate(input) {
      provider ??= insightProviderFactory();

      return provider.generate(input);
    },
  };
}

function toStoredAnalysis(input: {
  inputHash: string;
  response: AnalyzeResponse;
  tier: Tier;
}): {
  inputHash: string;
  model: string;
  result: ProInsights;
} | undefined {
  if (input.response.pro.insights === undefined) {
    return undefined;
  }

  return {
    inputHash: input.inputHash,
    model: MODEL_BY_TIER[input.tier],
    result: input.response.pro.insights,
  };
}

function toCachedInsights(value: unknown): ProInsights | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    summary?: unknown;
    insights?: unknown;
  };

  if (
    typeof candidate.summary !== "string" ||
    !Array.isArray(candidate.insights) ||
    !candidate.insights.every((insight) => typeof insight === "string")
  ) {
    return null;
  }

  return {
    summary: candidate.summary,
    insights: candidate.insights,
  };
}

function analysisInputHash(input: {
  csv: string | Buffer;
  tier: Tier;
}): string {
  const payload = JSON.stringify([
    AI_PROMPT_VERSION,
    MODEL_BY_TIER[input.tier],
    sourceHash(csvSourceText(input.csv)),
  ]);

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function proStatusForTier(tier: Tier): AnalyzeResponse["pro"]["status"] {
  return tier === "pro" ? "active" : "locked";
}

function toTransaction(parsed: ParsedTransaction): Transaction {
  const transaction: Transaction = {
    date: parsed.date,
    merchant: parsed.merchant,
    signedAmount: parsed.signedAmount,
    direction: parsed.direction,
    category: categorize(parsed.merchant),
    currency: parsed.currency,
    rowHash: rowHash(parsed),
  };
  const maskedAccount =
    parsed.account === undefined ? "" : maskAccount(parsed.account);

  if (maskedAccount !== "") {
    transaction.maskedAccount = maskedAccount;
  }

  return transaction;
}

async function generateInsights(input: {
  insightProvider: InsightProvider;
  transactions: Transaction[];
  tier: Tier;
  timeoutMs: number;
}): Promise<AnalyzeResponse["pro"]["insights"] | null> {
  try {
    return await withTimeout(
      input.insightProvider.generate({
        transactions: input.transactions,
        tier: input.tier,
      }),
      input.timeoutMs,
    );
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("AI insight generation timed out."));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}

function csvSourceText(input: string | Buffer): string {
  if (typeof input === "string") {
    return input;
  }

  return input.toString("utf8");
}
