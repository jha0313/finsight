import { describe, expect, it } from "vitest";

import { FINSIGHT_RULES, reviewerSystemPrompt } from "./rules";

describe("reviewerSystemPrompt", () => {
  it("모든 CRITICAL 룰을 시스템 프롬프트에 포함한다", () => {
    const prompt = reviewerSystemPrompt();

    for (const rule of FINSIGHT_RULES) {
      expect(prompt).toContain(rule);
    }
  });

  it("위반 없음/심각도 출력 형식을 지시한다", () => {
    const prompt = reviewerSystemPrompt();

    expect(prompt).toContain("위반 없음");
    expect(prompt).toContain("심각도");
  });
});
