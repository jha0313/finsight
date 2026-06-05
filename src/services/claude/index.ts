import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import type { ProInsights } from "@/types/analysis";
import type { ExtractedTransaction } from "@/types/pdf";
import type { InsightProvider, PdfTransactionExtractor } from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Category, Transaction } from "@/types/transaction";

const CLAUDE_TIMEOUT_MS = 60000;
const MAX_TRANSACTIONS_FOR_CLAUDE = 200;
// Opus 심층 인사이트가 잘리면 structured output JSON이 미완성되어 parse가
// 던지고(=인사이트 unavailable) 규칙 분석만 남는다. 출력 한도(아래 MAX_*)를
// 모두 덮도록 넉넉히 둔다. 실제 출력은 ~800토큰이라 상한일 뿐 비용·latency엔 영향 없다.
const MAX_OUTPUT_TOKENS = 8192;
const MAX_SUMMARY_CHARS = 1200;
const MAX_INSIGHTS = 8;
const MAX_INSIGHT_CHARS = 700;

const MODEL_BY_TIER: Record<Tier, string> = {
  free: "claude-sonnet-4-6",
  pro: "claude-opus-4-8",
};

// PDF 추출은 분석이 아닌 파싱 단계라 tier와 무관하게 비용·속도가 좋은
// Sonnet으로 고정한다. 대용량 텍스트는 char 상한으로 토큰을 방어한다.
// 추출은 거래 건수만큼 출력 토큰이 커서(수십~수백 건) insight보다 오래
// 걸리므로 전용 타임아웃을 둔다.
const PDF_EXTRACT_MODEL = "claude-sonnet-4-6";
const PDF_EXTRACT_TIMEOUT_MS = 60000;
const MAX_PDF_TEXT_CHARS = 80000;
const MAX_EXTRACT_OUTPUT_TOKENS = 8192;

const ExtractedTransactionSchema = z.object({
  date: z.string(),
  merchant: z.string(),
  amount: z.string(),
  direction: z.enum(["debit", "credit", "refund"]),
  currency: z.string(),
});

const PdfExtractionSchema = z.object({
  transactions: z.array(ExtractedTransactionSchema),
});

const PDF_EXTRACT_SYSTEM_PROMPT = [
  "당신은 finsight의 PDF 명세서 파서입니다.",
  "카드/은행 명세서에서 추출한 텍스트를 받아 거래 단위만 추출합니다.",
  "- date: 거래일을 YYYY-MM-DD로 정규화하세요. 명세서에 연도가 없으면 명세서 기간/명세일로 추론하세요.",
  "- merchant: 가맹점명 또는 거래 설명.",
  "- amount: 청구 통화로 환산된 금액의 절대값(부호·통화기호 없이, 숫자만). 외화 원금/환율(EXCHG RATE) 줄은 별도 거래가 아니므로 무시하세요.",
  '- direction: 일반 구매/지출은 "debit", 카드 결제·입금·계좌 이체는 "credit", 가맹점 환불·취소는 "refund".',
  "- currency: 명세서 청구 통화의 ISO 4217 코드(USD, CAD, KRW 등).",
  "제외 대상: 소계/합계(Subtotal/Total)·이전잔액·신규잔액·이자·수수료 요약·신용한도·포인트/리워드·환율 정보 줄.",
  "개인정보(이름·주소·카드/계좌번호)는 추출하지 마세요. 거래가 없으면 빈 배열을 반환하세요.",
  "응답은 지정된 structured output schema를 엄격히 따르세요.",
].join("\n");

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
  `요약(summary)은 ${MAX_SUMMARY_CHARS}자 이내, 인사이트(insights)는 중요한 순서로 최대 ${MAX_INSIGHTS}개이며 각 항목은 ${MAX_INSIGHT_CHARS}자 이내로 작성하세요.`,
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

      return clampInsightBounds(message.parsed_output);
    },
  };
}

// PDF는 은행마다 레이아웃이 제각각이라 결정론적 파서로 일반화하기 어렵다.
// 마스킹된 명세서 텍스트에서 거래 단위를 structured output으로 추출한다.
// 호출부(extractPdfStatement)가 실패를 격리하므로 여기서는 throw로 전파한다.
export function createClaudePdfExtractor(): PdfTransactionExtractor {
  return {
    async extract(input) {
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      const message = await client.messages.parse(
        {
          model: PDF_EXTRACT_MODEL,
          max_tokens: MAX_EXTRACT_OUTPUT_TOKENS,
          system: PDF_EXTRACT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: capPdfText(input.text),
            },
          ],
          output_config: {
            format: zodOutputFormat(PdfExtractionSchema),
          },
        },
        {
          timeout: PDF_EXTRACT_TIMEOUT_MS,
          maxRetries: 0,
        },
      );

      if (message.parsed_output === null) {
        throw new Error("Claude returned no parsed PDF extraction.");
      }

      return message.parsed_output.transactions as ExtractedTransaction[];
    },
  };
}

function capPdfText(text: string): string {
  return text.length > MAX_PDF_TEXT_CHARS
    ? text.slice(0, MAX_PDF_TEXT_CHARS)
    : text;
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

// 모델 출력이 한도를 살짝 넘었다고 throw하면 인사이트 전체가 null→unavailable로
// 떨어져, 사소한 초과가 기능 전체를 죽인다. 한도 내로 잘라내(clamp) 그래도 표시한다.
// 프롬프트(SYSTEM_PROMPT)로 모델에 한도를 알려주므로 clamp는 안전망 역할이다.
function clampInsightBounds(insights: ProInsights): ProInsights {
  return {
    summary: insights.summary.slice(0, MAX_SUMMARY_CHARS),
    insights: insights.insights
      .slice(0, MAX_INSIGHTS)
      .map((insight) => insight.slice(0, MAX_INSIGHT_CHARS)),
  };
}
