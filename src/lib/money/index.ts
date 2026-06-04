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

function parseMinorUnits(raw: string): bigint {
  const compact = raw.trim();

  if (compact === "") {
    return ZERO_MINOR_UNITS;
  }

  const sanitized = compact.replace(/[^\d.+\-()]/g, "");

  if (!/\d/.test(sanitized)) {
    return ZERO_MINOR_UNITS;
  }

  const isNegative = isNegativeToken(sanitized);
  const numericToken = sanitized.replace(/[()+-]/g, "");
  const [wholePart = "0", fractionalPart = "", unexpected] =
    numericToken.split(".");

  if (unexpected !== undefined || !/^\d*$/.test(wholePart)) {
    throw new Error(`Invalid money amount: ${raw}`);
  }

  if (!/^\d*$/.test(fractionalPart)) {
    throw new Error(`Invalid money amount: ${raw}`);
  }

  const wholeMinorUnits = BigInt(wholePart === "" ? "0" : wholePart);
  const paddedFraction = `${fractionalPart}00`;
  const cents = BigInt(paddedFraction.slice(0, 2));
  const shouldRoundUp = (fractionalPart[2] ?? "0") >= "5";
  const roundedCents = shouldRoundUp ? cents + ONE_MINOR_UNIT : cents;
  const absoluteMinorUnits = wholeMinorUnits * MINOR_UNIT + roundedCents;

  if (absoluteMinorUnits === ZERO_MINOR_UNITS) {
    return ZERO_MINOR_UNITS;
  }

  return isNegative ? -absoluteMinorUnits : absoluteMinorUnits;
}

function formatMinorUnits(minorUnits: bigint): string {
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
