import { describe, it, expect } from "vitest";

import { currencySymbol, formatWithCurrency } from ".";

describe("currencySymbol", () => {
  it("주요 통화 코드를 기호로 매핑한다", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("KRW")).toBe("₩");
    expect(currencySymbol("JPY")).toBe("¥");
    expect(currencySymbol("GBP")).toBe("£");
  });

  it("소문자 코드도 대소문자 무관하게 처리한다", () => {
    expect(currencySymbol("krw")).toBe("₩");
  });

  it("미지원 코드는 대문자 코드 그대로 반환한다", () => {
    expect(currencySymbol("aud")).toBe("AUD");
  });
});

describe("formatWithCurrency", () => {
  it("기호형 통화는 금액에 붙여 쓴다", () => {
    expect(formatWithCurrency("1234.56", "USD")).toBe("$1234.56");
    expect(formatWithCurrency("9000.00", "KRW")).toBe("₩9000.00");
  });

  it("미지원 코드형은 코드와 금액 사이에 공백을 둔다", () => {
    expect(formatWithCurrency("1234.56", "AUD")).toBe("AUD 1234.56");
  });
});
