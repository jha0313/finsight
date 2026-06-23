// LLM-as-judge: golden 케이스의 기대(라벨)와 리뷰어 출력을 비교해 pass/fail로 채점한다.
// 채점은 리뷰어(Sonnet)와 다른 모델(Opus)로 돌려 '다른 모델이 채점' 컨셉을 따른다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

const JUDGE_MODEL = "claude-opus-4-8";
const TIMEOUT_MS = 30000;
const MAX_TOKENS = 1024;

export const JudgeVerdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  reasoning: z.string(),
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export interface JudgeInput {
  rule: string;
  expect: "violation" | "pass";
  severity: string;
  reviewerOutput: string;
}

export interface QaJudgeInput {
  question: string;
  must: string[];
  mustNot: string[];
  answer: string;
}

export interface OncallJudgeInput {
  expectTriage: "noise" | "signal";
  must: string[];
  mustNot: string[];
  triagerOutput: string;
}

export interface Judge {
  judge(input: JudgeInput): Promise<JudgeVerdict>;
  judgeQa(input: QaJudgeInput): Promise<JudgeVerdict>;
  judgeOncall(input: OncallJudgeInput): Promise<JudgeVerdict>;
}

const JUDGE_SYSTEM = [
  "당신은 finsight 하네스 Eval의 채점관(LLM-as-judge)입니다.",
  "golden 케이스의 기대(expect)와 리뷰어 출력을 비교해, 리뷰어가 기대대로 행동했는지 판정하세요.",
  "- expect=violation: 리뷰어가 명시된 룰의 위반을 지적했고 심각도가 기대와 부합하면 pass, 위반을 놓쳤거나 심각도가 크게 어긋나면 fail.",
  "- expect=pass: 리뷰어가 이 코드에 위반/문제를 제기하지 않았으면 pass, 존재하지 않는 위반을 지적(오탐)했으면 fail.",
  "verdict(pass|fail)와 한국어 reasoning을 structured output으로 반환하세요.",
].join("\n");

const JUDGE_QA_SYSTEM = [
  "당신은 finsight 하네스 Eval의 QA 채점관(LLM-as-judge)입니다.",
  "응답자의 답변이 기대 사실(must)을 모두 담고, 금지 사실(must_not)을 사실처럼 말하지 않았는지 판정하세요.",
  "- must의 각 항목이 (표현은 달라도) 답변에 사실로 담겨 있으면 충족.",
  "- must_not의 항목을 사실처럼 주장하면(틀린 전제에 동조·환각·오답) fail.",
  "- must를 모두 충족하고 must_not을 하나도 범하지 않으면 pass, 아니면 fail.",
  "verdict(pass|fail)와 한국어 reasoning을 structured output으로 반환하세요.",
].join("\n");

const JUDGE_ONCALL_SYSTEM = [
  "당신은 finsight oncall 하네스 Eval의 채점관(LLM-as-judge)입니다.",
  "oncall 에이전트가 prod alert를 기대 판정(expect_triage)으로 분류하고, 요건(must)을 갖추고 금지(must_not)를 범하지 않았는지 판정하세요.",
  "- 에이전트 출력의 최종 분류가 expect_triage(noise/signal)와 일치해야 한다. 어긋나면 fail.",
  "- expect_triage=signal: must의 escalation 구성요소(원인 가설·영향 범위·권장 액션 등)가 (표현은 달라도) 담겨 있으면 충족.",
  "- expect_triage=noise: 에이전트가 사람을 깨우지 않기로 했고 must를 충족하면 충족.",
  "- must_not의 항목을 행하거나 주장하면 fail(예: 노이즈인데 escalation, 신호인데 침묵).",
  "- must를 모두 충족하고 must_not을 하나도 범하지 않으면 pass, 아니면 fail.",
  "verdict(pass|fail)와 한국어 reasoning을 structured output으로 반환하세요.",
].join("\n");

export function judgeUserContent(input: JudgeInput): string {
  return [
    `[기대] expect=${input.expect}, severity=${input.severity}`,
    `[채점 대상 룰] ${input.rule}`,
    "[리뷰어 출력]",
    input.reviewerOutput,
  ].join("\n");
}

export function qaJudgeUserContent(input: QaJudgeInput): string {
  return [
    `[질문] ${input.question}`,
    "[반드시 담겨야 할 사실(must)]",
    ...input.must.map((fact, index) => `  ${index + 1}. ${fact}`),
    "[말하면 안 되는 오답(must_not)]",
    ...(input.mustNot.length > 0
      ? input.mustNot.map((fact, index) => `  ${index + 1}. ${fact}`)
      : ["  (없음)"]),
    "[응답자 답변]",
    input.answer,
  ].join("\n");
}

export function oncallJudgeUserContent(input: OncallJudgeInput): string {
  return [
    `[기대 판정] expect_triage=${input.expectTriage}`,
    "[충족해야 할 요건(must)]",
    ...input.must.map((fact, index) => `  ${index + 1}. ${fact}`),
    "[하면 안 되는 것(must_not)]",
    ...(input.mustNot.length > 0
      ? input.mustNot.map((fact, index) => `  ${index + 1}. ${fact}`)
      : ["  (없음)"]),
    "[에이전트 출력]",
    input.triagerOutput,
  ].join("\n");
}

async function score(system: string, userContent: string): Promise<JudgeVerdict> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.parse(
    {
      model: JUDGE_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userContent }],
      output_config: {
        format: zodOutputFormat(JudgeVerdictSchema),
      },
    },
    { timeout: TIMEOUT_MS, maxRetries: 5 },
  );

  if (message.parsed_output === null) {
    throw new Error("Judge가 verdict를 파싱하지 못했습니다.");
  }

  return message.parsed_output;
}

export function createClaudeJudge(): Judge {
  return {
    judge: (input) => score(JUDGE_SYSTEM, judgeUserContent(input)),
    judgeQa: (input) => score(JUDGE_QA_SYSTEM, qaJudgeUserContent(input)),
    judgeOncall: (input) =>
      score(JUDGE_ONCALL_SYSTEM, oncallJudgeUserContent(input)),
  };
}
