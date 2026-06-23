import { describe, expect, it } from "vitest";

import { JudgeVerdictSchema, judgeUserContent, qaJudgeUserContent } from "./judge";

describe("JudgeVerdictSchema", () => {
  it("verdict는 pass/fail만 허용한다", () => {
    expect(
      JudgeVerdictSchema.safeParse({ verdict: "pass", reasoning: "ok" }).success,
    ).toBe(true);
    expect(
      JudgeVerdictSchema.safeParse({ verdict: "maybe", reasoning: "x" }).success,
    ).toBe(false);
  });
});

describe("judgeUserContent", () => {
  it("기대 라벨과 리뷰어 출력을 함께 담는다", () => {
    const content = judgeUserContent({
      rule: "lib는 SDK import 금지",
      expect: "violation",
      severity: "critical",
      reviewerOutput: "critical 위반입니다",
    });

    expect(content).toContain("lib는 SDK import 금지");
    expect(content).toContain("violation");
    expect(content).toContain("critical 위반입니다");
  });
});

describe("qaJudgeUserContent", () => {
  it("질문·must·mustNot·답변을 함께 담는다", () => {
    const content = qaJudgeUserContent({
      question: "분석은 동기인가요?",
      must: ["동기 처리다", "단일 트랜잭션"],
      mustNot: ["비동기 큐가 맞다"],
      answer: "동기로 처리합니다.",
    });

    expect(content).toContain("분석은 동기인가요?");
    expect(content).toContain("동기 처리다");
    expect(content).toContain("단일 트랜잭션");
    expect(content).toContain("비동기 큐가 맞다");
    expect(content).toContain("동기로 처리합니다.");
  });

  it("mustNot이 비면 '(없음)'으로 표기한다", () => {
    const content = qaJudgeUserContent({
      question: "q",
      must: ["사실"],
      mustNot: [],
      answer: "a",
    });

    expect(content).toContain("(없음)");
  });
});
