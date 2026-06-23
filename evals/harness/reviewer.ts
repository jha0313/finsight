// eval 대상: CLAUDE.md 룰을 적용해 코드 변경을 리뷰하는 경량 단일 호출 하네스.
// 출력은 산문 리뷰라, 나중에 headless `/review-code`로 교체해도 judge 인터페이스는
// 그대로다(둘 다 코드를 받아 산문 리뷰를 돌려준다).
import Anthropic from "@anthropic-ai/sdk";

import { reviewerSystemPrompt } from "./rules";

const REVIEWER_MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;

export interface Reviewer {
  review(code: string): Promise<string>;
}

type ContentBlockLike = { type: string; text?: string };

export function extractText(content: ContentBlockLike[]): string {
  return content
    .filter(
      (block): block is { type: "text"; text: string } =>
        block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function createClaudeReviewer(): Reviewer {
  return {
    async review(code) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create(
        {
          model: REVIEWER_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0,
          system: reviewerSystemPrompt(),
          messages: [{ role: "user", content: code }],
        },
        { timeout: TIMEOUT_MS, maxRetries: 5 },
      );

      return extractText(message.content);
    },
  };
}
