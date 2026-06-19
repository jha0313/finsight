// ISO 4217 통화 코드 → 표시 기호. 글로벌 명세서의 다통화 금액을 화면에 표기할 때 쓴다.
// 금액 자체는 string(numeric 규약)으로 다루고, 이 모듈은 표시용 기호만 책임진다.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  KRW: "₩",
  JPY: "¥",
  GBP: "£",
};

// 통화 코드를 기호로 변환한다. 미지원 코드는 대문자 코드를 그대로 돌려준다.
export function currencySymbol(code: string): string {
  const normalized = code.toUpperCase();
  return CURRENCY_SYMBOLS[normalized] ?? normalized;
}

// 금액 문자열에 통화 표기를 붙인다. 단일 문자 기호($,₩ 등)는 붙여 쓰고,
// 미지원 코드(기호 대신 코드)는 가독성을 위해 공백을 둔다.
export function formatWithCurrency(amount: string, code: string): string {
  const symbol = currencySymbol(code);
  const isSymbol = symbol.length === 1;
  return isSymbol ? `${symbol}${amount}` : `${symbol} ${amount}`;
}
