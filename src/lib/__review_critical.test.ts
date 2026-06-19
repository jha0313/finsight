// 자동 리뷰 게이트(critical 분기) 검증용 임시 테스트. 테스트 후 삭제.
import { describe, it, expect } from "vitest";
import { parseStatementAmount } from "./__review_critical";

describe("parseStatementAmount (리뷰 게이트 검증용 임시)", () => {
  it("통화기호/콤마를 제거하고 숫자로 변환한다", () => {
    expect(parseStatementAmount("$1,234.56")).toBeCloseTo(1234.56);
  });
});
