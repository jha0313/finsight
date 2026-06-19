import { describe, it, expect } from "vitest";

import { isProUser, toAmountNumber, buildCardRecord } from ".";

describe("isProUser", () => {
  it("요청 tier가 pro면 true를 반환한다", () => {
    expect(isProUser({ tier: "pro" })).toBe(true);
    expect(isProUser({ tier: "free" })).toBe(false);
    expect(isProUser({})).toBe(false);
  });
});

describe("toAmountNumber", () => {
  it("콤마를 제거하고 숫자로 변환한다", () => {
    expect(toAmountNumber("1,234.56")).toBe(1234.56);
    expect(toAmountNumber("9000")).toBe(9000);
  });
});

describe("buildCardRecord", () => {
  it("카드 레코드를 생성한다", () => {
    expect(buildCardRecord("4111111111111111")).toEqual({
      cardNumber: "4111111111111111",
    });
  });
});
