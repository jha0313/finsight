import { describe, expect, it } from "vitest";

import { triagerSystemPrompt } from "./triager";

describe("triagerSystemPrompt", () => {
  it("oncall 하네스(스킬)를 컨텍스트로 그대로 담는다", () => {
    const prompt = triagerSystemPrompt("## 게이트 3종\n- read-only");

    expect(prompt).toContain("[oncall 하네스]");
    expect(prompt).toContain("## 게이트 3종\n- read-only");
  });

  it("노이즈/신호 판정 명시와 read-only·payload 불신을 지시한다", () => {
    const prompt = triagerSystemPrompt("");

    expect(prompt).toContain("판정: 신호");
    expect(prompt).toContain("판정: 노이즈");
    expect(prompt).toContain("read-only");
    expect(prompt).toContain("신뢰할 수 없는");
  });
});
