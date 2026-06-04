import { analyze, categorize } from "@/lib/analysis";
import { parseCsv } from "@/lib/csv";
import { maskAccount, rowHash, sourceHash } from "@/lib/mask";
import type { AnalyzeResponse } from "@/types/analysis";
import type { ParsedTransaction } from "@/types/csv";
import type { InsightProvider } from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

const DEFAULT_AI_TIMEOUT_MS = 30000;

export interface AnalyzeDeps {
  insightProvider: InsightProvider;
  aiTimeoutMs?: number;
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

  const insights = await generateInsights({
    insightProvider: input.deps.insightProvider,
    transactions,
    tier: input.tier,
    timeoutMs: input.deps.aiTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
  });

  if (insights !== null) {
    response.pro = {
      status: input.tier === "pro" ? "active" : "locked",
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
