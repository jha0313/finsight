import { describe, expect, it } from "vitest";

import { CASES_DIR, loadCases } from "./run";

// golden set 파일 자체의 무결성을 네트워크 없이 지키는 테스트.
// 케이스를 잘못 추가하면(잘못된 frontmatter·균형 붕괴) npm test에서 바로 깨진다.
describe("loadCases (golden set 무결성)", () => {
  const cases = loadCases(CASES_DIR);
  const review = cases.filter((c) => c.kind === "review");
  const qa = cases.filter((c) => c.kind === "qa");
  const oncall = cases.filter((c) => c.kind === "oncall");

  it("review 셋은 위반 4개 + 정상(오탐 방지) 1개로 균형을 잡는다", () => {
    expect(review.filter((c) => c.expect === "violation")).toHaveLength(4);
    expect(review.filter((c) => c.expect === "pass")).toHaveLength(1);
  });

  it("qa 셋은 모두 기대 사실(must)을 가지며 전제반박 가드를 포함한다", () => {
    expect(qa.length).toBeGreaterThanOrEqual(1);
    expect(qa.every((c) => c.must.length > 0)).toBe(true);
    expect(qa.some((c) => c.mustNot.length > 0)).toBe(true);
  });

  it("oncall 셋은 신호/노이즈 균형 + triage·must를 모두 갖는다", () => {
    expect(
      oncall.filter((c) => c.triage === "signal").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      oncall.filter((c) => c.triage === "noise").length,
    ).toBeGreaterThanOrEqual(1);
    expect(oncall.every((c) => c.must.length > 0)).toBe(true);
  });

  it("모든 케이스 id가 유일하다", () => {
    const ids = cases.map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
