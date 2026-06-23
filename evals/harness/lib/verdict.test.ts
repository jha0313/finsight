import { describe, expect, it } from "vitest";

import { type CaseResult, formatSummary, summarize } from "./verdict";

function result(
  id: string,
  verdict: "pass" | "fail",
  reasoning = "",
): CaseResult {
  return { id, expect: "violation", verdict, reasoning };
}

describe("summarize", () => {
  it("통과/실패 수와 통과율을 집계한다", () => {
    const summary = summarize([
      result("a", "pass"),
      result("b", "pass"),
      result("c", "fail", "놓침"),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.failedIds).toEqual(["c"]);
  });

  it("빈 결과는 통과율 0으로 둔다", () => {
    const summary = summarize([]);

    expect(summary.total).toBe(0);
    expect(summary.passRate).toBe(0);
    expect(summary.failedIds).toEqual([]);
  });
});

describe("formatSummary", () => {
  it("회귀가 없으면 '회귀 없음'을 적는다", () => {
    const text = formatSummary([result("a", "pass")]);

    expect(text).toContain("1/1 통과 (100%)");
    expect(text).toContain("회귀 없음");
  });

  it("실패 케이스의 id와 사유를 노출한다", () => {
    const text = formatSummary([result("c", "fail", "오탐 발생")]);

    expect(text).toContain("✗ FAIL  c");
    expect(text).toContain("오탐 발생");
    expect(text).toContain("회귀 1건: c");
  });
});
