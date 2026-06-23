import { describe, expect, it } from "vitest";

import { extractText } from "./reviewer";

describe("extractText", () => {
  it("text 블록만 추출해 합친다", () => {
    const text = extractText([
      { type: "text", text: "첫 줄" },
      { type: "tool_use" },
      { type: "text", text: "둘째 줄" },
    ]);

    expect(text).toBe("첫 줄\n둘째 줄");
  });

  it("text 블록이 없으면 빈 문자열을 돌려준다", () => {
    expect(extractText([{ type: "tool_use" }])).toBe("");
  });
});
