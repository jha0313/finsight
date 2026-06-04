import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import type { ProInsights } from "@/types/analysis";
import type { InsightProvider } from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Category, Transaction } from "@/types/transaction";

const CLAUDE_TIMEOUT_MS = 30000;
const MAX_TRANSACTIONS_FOR_CLAUDE = 200;
const MAX_OUTPUT_TOKENS = 1200;
const MAX_SUMMARY_CHARS = 1200;
const MAX_INSIGHTS = 8;
const MAX_INSIGHT_CHARS = 700;

const MODEL_BY_TIER: Record<Tier, string> = {
  free: "claude-sonnet-4-6",
  pro: "claude-opus-4-8",
};

const ProInsightsSchema = z.object({
  summary: z.string(),
  insights: z.array(z.string()),
});

type ClaudeTransaction = {
  date: string;
  merchant: string;
  amount: string;
  category: Category;
};

type ClaudeTransactionPayload = {
  totalTransactions: number;
  includedTransactions: number;
  omittedTransactions: number;
  transactions: ClaudeTransaction[];
};

const SYSTEM_PROMPT = [
  "당신은 finsight의 금융 명세서 분석 어댑터입니다.",
  "제공된 거래 단위 데이터만 근거로 한국어 인사이트를 작성하세요.",
  "직접 식별자나 계좌 정보를 요구하거나 추론하지 마세요.",
  "응답은 지정된 structured output schema를 엄격히 따르세요.",
].join(" ");

export function createClaudeInsightProvider(): InsightProvider {
  return {
    async generate(input) {
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const message = await client.messages.parse(
        {
          model: MODEL_BY_TIER[input.tier],
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: JSON.stringify(toClaudeTransactionPayload(input.transactions)),
            },
          ],
          output_config: {
            format: zodOutputFormat(ProInsightsSchema),
          },
        },
        {
          timeout: CLAUDE_TIMEOUT_MS,
          maxRetries: 0,
        },
      );

      if (message.parsed_output === null) {
        throw new Error("Claude returned no parsed output.");
      }

      return validateInsightBounds(message.parsed_output);
    },
  };
}

function toClaudeTransactionPayload(
  transactions: Transaction[],
): ClaudeTransactionPayload {
  const selectedTransactions = transactions.slice(0, MAX_TRANSACTIONS_FOR_CLAUDE);

  return {
    totalTransactions: transactions.length,
    includedTransactions: selectedTransactions.length,
    omittedTransactions: Math.max(
      transactions.length - selectedTransactions.length,
      0,
    ),
    transactions: selectedTransactions.map(toClaudeTransaction),
  };
}

function toClaudeTransaction(transaction: Transaction): ClaudeTransaction {
  return {
    date: transaction.date,
    merchant: transaction.merchant,
    amount: transaction.signedAmount,
    category: transaction.category,
  };
}

function validateInsightBounds(insights: ProInsights): ProInsights {
  if (insights.summary.length > MAX_SUMMARY_CHARS) {
    throw new Error("Claude parsed output summary exceeds supported length.");
  }

  if (insights.insights.length > MAX_INSIGHTS) {
    throw new Error("Claude parsed output contains too many insights.");
  }

  for (const insight of insights.insights) {
    if (insight.length > MAX_INSIGHT_CHARS) {
      throw new Error("Claude parsed output insight exceeds supported length.");
    }
  }

  return insights;
}
