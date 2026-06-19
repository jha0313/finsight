// 자동 리뷰 게이트(minor 분기) 검증용 임시 테스트. 테스트 후 삭제.
import { describe, it, expect } from "vitest";
import { averageAmount } from "./__review_minor";

describe("averageAmount (리뷰 게이트 검증용 임시)", () => {
  it("금액 평균을 계산한다", () => {
    expect(averageAmount([10, 20, 30])).toBe(20);
  });
});
