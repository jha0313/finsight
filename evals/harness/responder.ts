// QA 하네스(eval 대상): finsight CLAUDE.md를 컨텍스트로 받아 코드베이스 질문에 답한다.
// 리뷰어와 같은 "문자열 in → 산문 out" 계약. 지식원은 라이브 CLAUDE.md(레포 정본)라,
// QA 케이스는 "CLAUDE.md가 그 질문에 답할 만큼 충분한가"를 측정한다(gotcha 한 줄을 지우면
// 해당 케이스가 회귀로 잡힌다). reviewer.ts와 짝을 이루며 extractText를 공유한다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { extractText } from "./reviewer";

const RESPONDER_MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;

// 레포 정본 CLAUDE.md(evals/harness/ → 레포 루트).
export const CLAUDE_MD_PATH = fileURLToPath(
  new URL("../../CLAUDE.md", import.meta.url),
);

export function responderSystemPrompt(claudeMd: string): string {
  return [
    "당신은 finsight 코드베이스에 정통한 시니어 엔지니어입니다.",
    "아래 CLAUDE.md(프로젝트 규약·gotcha·예외처리 정본)에 근거해 질문에 답하세요.",
    "- CLAUDE.md에 근거가 있으면 그 사실로 정확히 답하세요.",
    "- 질문의 전제가 틀렸으면 동조하지 말고 바로잡으세요.",
    "- CLAUDE.md에 없는 내용은 지어내지 말고 모른다고 하세요.",
    "한국어 산문으로 간결하게 답하세요.",
    "",
    "[CLAUDE.md]",
    claudeMd,
  ].join("\n");
}

export interface Responder {
  answer(question: string): Promise<string>;
}

export function createClaudeResponder(): Responder {
  const claudeMd = readFileSync(CLAUDE_MD_PATH, "utf8");

  return {
    async answer(question) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create(
        {
          model: RESPONDER_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0,
          system: responderSystemPrompt(claudeMd),
          messages: [{ role: "user", content: question }],
        },
        { timeout: TIMEOUT_MS, maxRetries: 5 },
      );

      return extractText(message.content);
    },
  };
}
