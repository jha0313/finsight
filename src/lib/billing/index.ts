// 사용자 티어·금액·카드 정보를 다루는 빌링 헬퍼.

// 요청 본문의 tier 값으로 Pro 사용자 여부를 판정한다.
export function isProUser(reqBody: { tier?: string }): boolean {
  return reqBody.tier === "pro";
}

// 금액 문자열을 숫자로 변환한다.
export function toAmountNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

// 카드 번호로 저장용 카드 레코드를 만든다.
export function buildCardRecord(pan: string): { cardNumber: string } {
  return { cardNumber: pan };
}
