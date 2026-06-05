import type { Direction } from "@/types/transaction";

type SignedAmount = {
  signedAmount: string;
  direction: Direction;
};

const ZERO_MINOR_UNITS = BigInt("0");
const ONE_MINOR_UNIT = BigInt("1");
const TEN_MINOR_UNITS = BigInt("10");
const MINOR_UNIT = BigInt("100");
const ZERO_MONEY = "0.00";

export function parseAmount(raw: string): string {
  return formatMinorUnits(parseMinorUnits(raw));
}

export function deriveSignedAmount(input: {
  amount?: string;
  debit?: string;
  credit?: string;
}): SignedAmount {
  const hasDebit = hasAmountCell(input.debit);
  const hasCredit = hasAmountCell(input.credit);

  if (hasDebit || hasCredit) {
    const debit = absMinorUnits(parseMinorUnits(input.debit ?? ""));
    const credit = absMinorUnits(parseMinorUnits(input.credit ?? ""));
    const signedMinorUnits = debit - credit;

    return {
      signedAmount: formatMinorUnits(signedMinorUnits),
      direction:
        signedMinorUnits < ZERO_MINOR_UNITS ? "credit" : "debit",
    };
  }

  const signedMinorUnits = parseMinorUnits(input.amount ?? "");

  return {
    signedAmount: formatMinorUnits(signedMinorUnits),
    direction:
      signedMinorUnits < ZERO_MINOR_UNITS ? "refund" : "debit",
  };
}

export function addMoney(a: string, b: string): string {
  return formatMinorUnits(parseMinorUnits(a) + parseMinorUnits(b));
}

export function sumMoney(values: string[]): string {
  const total = values.reduce(
    (sum, value) => sum + parseMinorUnits(value),
    ZERO_MINOR_UNITS,
  );

  return formatMinorUnits(total);
}

export function negateMoney(a: string): string {
  return formatMinorUnits(-parseMinorUnits(a));
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const left = parseMinorUnits(a);
  const right = parseMinorUnits(b);

  if (left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

export function parseMinorUnits(raw: string): bigint {
  const compact = raw.normalize("NFKC").trim();

  if (compact === "" || !/\d/.test(compact)) {
    return ZERO_MINOR_UNITS;
  }

  const { isNegative, whole, fraction } = parseDecimalToken(compact);
  const wholeMinorUnits = BigInt(whole === "" ? "0" : whole) * MINOR_UNIT;
  const paddedFraction = `${fraction}00`;
  const cents = BigInt(paddedFraction.slice(0, 2));
  const shouldRoundUp = (fraction[2] ?? "0") >= "5";
  const roundedCents = shouldRoundUp ? cents + ONE_MINOR_UNIT : cents;
  const absoluteMinorUnits = wholeMinorUnits + roundedCents;

  if (absoluteMinorUnits === ZERO_MINOR_UNITS) {
    return ZERO_MINOR_UNITS;
  }

  return isNegative ? -absoluteMinorUnits : absoluteMinorUnits;
}

// 통화기호·부호를 제거하고 콤마/점의 역할(소수점 vs 천단위)을 로케일
// 휴리스틱으로 판별한다. 글로벌 명세서(유럽식 1.234,56)도 손실 없이 파싱한다.
function parseDecimalToken(compact: string): {
  isNegative: boolean;
  whole: string;
  fraction: string;
} {
  const isNegative = isNegativeToken(compact);
  const token = compact.replace(/[^\d.,]/g, "");

  if (token === "") {
    return { isNegative, whole: "", fraction: "" };
  }

  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");
  let decimalSep = "";

  if (lastDot >= 0 && lastComma >= 0) {
    // 둘 다 있으면 더 오른쪽이 소수 구분자, 나머지는 천단위.
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma >= 0) {
    // 콤마만: 1개이고 뒤 1~2자리면 소수점, 그 외(여러 개·3자리)는 천단위.
    decimalSep = isSingleDecimalComma(token) ? "," : "";
  } else if (lastDot >= 0) {
    // 점만: 1개면 소수점(자릿수 무관), 여러 개면 천단위 그룹으로 본다.
    // (이미 정규화된 "1234.567" 같은 값이 천단위로 오해되지 않게 한다.)
    decimalSep = token.split(".").length - 1 === 1 ? "." : "";
  }

  if (decimalSep === "") {
    return { isNegative, whole: stripThousands(token), fraction: "" };
  }

  const splitIndex = token.lastIndexOf(decimalSep);
  const fraction = token.slice(splitIndex + 1);

  if (!/^\d+$/.test(fraction)) {
    throw new Error(`Invalid money amount: ${compact}`);
  }

  return {
    isNegative,
    whole: stripThousands(token.slice(0, splitIndex)),
    fraction,
  };
}

// 콤마가 1개이고 뒤가 1~2자리이면 소수점(유럽식 1234,56), 그 외(여러 개·
// 3자리 그룹)는 천단위로 본다. 금액 소수부는 사실상 항상 2자리이다.
function isSingleDecimalComma(token: string): boolean {
  if (token.split(",").length - 1 !== 1) {
    return false;
  }

  const fractionLength = token.length - token.lastIndexOf(",") - 1;

  return fractionLength === 1 || fractionLength === 2;
}

// 천단위 구분자를 검증하며 제거한다. 첫 그룹은 1~3자리, 이후 그룹은 정확히
// 3자리여야 한다. 비정상 배치(예: "1.2.3")는 throw해 호출부가 행을 격리한다.
function stripThousands(intPart: string): string {
  if (intPart === "") {
    return "0";
  }

  if (!/[.,]/.test(intPart)) {
    if (!/^\d+$/.test(intPart)) {
      throw new Error(`Invalid money amount: ${intPart}`);
    }

    return intPart;
  }

  const hasDot = intPart.includes(".");
  const hasComma = intPart.includes(",");

  if (hasDot && hasComma) {
    throw new Error(`Invalid money amount: ${intPart}`);
  }

  const groups = intPart.split(hasDot ? "." : ",");

  if (!/^\d{1,3}$/.test(groups[0])) {
    throw new Error(`Invalid money amount: ${intPart}`);
  }

  for (let index = 1; index < groups.length; index += 1) {
    if (!/^\d{3}$/.test(groups[index])) {
      throw new Error(`Invalid money amount: ${intPart}`);
    }
  }

  return groups.join("");
}

export function formatMinorUnits(minorUnits: bigint): string {
  if (minorUnits === ZERO_MINOR_UNITS) {
    return ZERO_MONEY;
  }

  const sign = minorUnits < ZERO_MINOR_UNITS ? "-" : "";
  const absoluteMinorUnits = absMinorUnits(minorUnits);
  const whole = absoluteMinorUnits / MINOR_UNIT;
  const cents = absoluteMinorUnits % MINOR_UNIT;
  const centsText = cents < TEN_MINOR_UNITS ? `0${cents}` : `${cents}`;

  return `${sign}${whole}.${centsText}`;
}

function isNegativeToken(token: string): boolean {
  const withoutWhitespace = token.replace(/\s/g, "");

  return (
    (withoutWhitespace.startsWith("(") && withoutWhitespace.endsWith(")")) ||
    withoutWhitespace.startsWith("-") ||
    withoutWhitespace.endsWith("-")
  );
}

function hasAmountCell(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

function absMinorUnits(value: bigint): bigint {
  return value < ZERO_MINOR_UNITS ? -value : value;
}
