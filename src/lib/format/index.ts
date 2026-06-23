import { parseAmount } from "@/lib/money";
import type { Category, Direction } from "@/types/transaction";

const DEFAULT_CURRENCY = "KRW";
const ZERO = BigInt("0");
const TEN = BigInt("10");
const ONE_HUNDRED = BigInt("100");
const ONE_THOUSAND = BigInt("1000");

const CURRENCY_SYMBOLS: Partial<Record<string, string>> = {
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
  USD: "$",
};

const CATEGORY_LABELS: Record<Category, string> = {
  entertainment: "엔터테인먼트",
  finance: "금융",
  food: "식비",
  health: "건강",
  income: "수입",
  other: "기타",
  shopping: "쇼핑",
  transport: "교통",
  utilities: "공과금",
};

// 통화 코드가 심볼을 가진(지원되는) 코드인지 확인.
export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_SYMBOLS[code.toUpperCase()] !== undefined;
}

export function formatMoney(
  decimal: string,
  currency = DEFAULT_CURRENCY,
): string {
  const normalized = parseAmount(decimal);
  const isNegative = normalized.startsWith("-");
  const amount = isNegative ? normalized.slice(1) : normalized;
  const [whole, cents = "00"] = amount.split(".");
  const groupedWhole = groupThousands(whole);
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const sign = isNegative ? "-" : "";

  if (symbol !== undefined) {
    return `${sign}${symbol}${groupedWhole}.${cents}`;
  }

  return `${sign}${code} ${groupedWhole}.${cents}`;
}

export function formatPercent(part: string, total: string): string {
  const partMinorUnits = parseDecimalMinorUnits(part);
  const totalMinorUnits = parseDecimalMinorUnits(total);

  if (totalMinorUnits === ZERO) {
    return "0.0%";
  }

  const isNegative = partMinorUnits < ZERO !== totalMinorUnits < ZERO;
  const numerator = absBigInt(partMinorUnits) * ONE_THOUSAND;
  const denominator = absBigInt(totalMinorUnits);
  const percentTenths = (numerator + denominator / BigInt("2")) / denominator;
  const whole = percentTenths / TEN;
  const tenth = percentTenths % TEN;
  const sign = isNegative && percentTenths !== ZERO ? "-" : "";

  return `${sign}${whole}.${tenth}%`;
}

export function formatDate(iso: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(iso);

  if (monthMatch !== null) {
    return `${monthMatch[1]}.${monthMatch[2]}`;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);

  if (dateMatch !== null) {
    return `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
  }

  return iso;
}

export function directionColorClass(direction: Direction): string {
  return direction === "debit" ? "num down" : "num up";
}

export function formatCategory(category: Category): string {
  return CATEGORY_LABELS[category];
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseDecimalMinorUnits(decimal: string): bigint {
  const normalized = parseAmount(decimal);
  const isNegative = normalized.startsWith("-");
  const amount = isNegative ? normalized.slice(1) : normalized;
  const [whole, cents = "00"] = amount.split(".");
  const minorUnits = BigInt(whole) * ONE_HUNDRED + BigInt(cents);

  return isNegative ? -minorUnits : minorUnits;
}

function absBigInt(value: bigint): bigint {
  return value < ZERO ? -value : value;
}
