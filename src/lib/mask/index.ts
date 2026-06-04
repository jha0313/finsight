import { createHash } from "node:crypto";

import type { ParsedTransaction } from "@/types/csv";

const HASH_VERSION = "mask:v1";
const MASK_GROUP = "****";
const IDENTIFIER_VISIBLE_CHARS = 4;
const IDENTIFIER_GROUP_SIZE = 4;
const ZERO_MINOR_UNITS = BigInt("0");
const ONE_MINOR_UNIT = BigInt("1");
const MINOR_UNIT = BigInt("100");

export function maskAccount(raw: string): string {
  const normalized = normalizeIdentifier(raw);

  if (normalized === "") {
    return "";
  }

  if (normalized.length <= IDENTIFIER_VISIBLE_CHARS) {
    return MASK_GROUP;
  }

  const visible = normalized.slice(-IDENTIFIER_VISIBLE_CHARS);
  const hiddenLength = normalized.length - IDENTIFIER_VISIBLE_CHARS;
  const maskedGroupCount = Math.ceil(hiddenLength / IDENTIFIER_GROUP_SIZE);

  return [
    ...Array<string>(maskedGroupCount).fill(MASK_GROUP),
    visible,
  ].join(" ");
}

export function rowHash(transaction: ParsedTransaction): string {
  return sha256(canonicalPayload("row", canonicalTransaction(transaction)));
}

export function sourceHash(input: string | ParsedTransaction[]): string {
  if (typeof input === "string") {
    return sha256(canonicalPayload("source-text", normalizeSourceText(input)));
  }

  const rows = input
    .map((transaction) => JSON.stringify(canonicalTransaction(transaction)))
    .sort();

  return sha256(canonicalPayload("source-transactions", rows));
}

function canonicalTransaction(transaction: ParsedTransaction): {
  account: string;
  currency: string;
  date: string;
  direction: string;
  merchant: string;
  signedAmount: string;
} {
  return {
    date: normalizeText(transaction.date),
    merchant: normalizeMerchant(transaction.merchant),
    signedAmount: normalizeDecimal(transaction.signedAmount),
    direction: transaction.direction,
    currency: normalizeCurrency(transaction.currency),
    account: normalizeIdentifier(transaction.account ?? ""),
  };
}

function canonicalPayload(kind: string, payload: unknown): string {
  return JSON.stringify([HASH_VERSION, kind, payload]);
}

function sha256(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function normalizeIdentifier(raw: string): string {
  return raw
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

function normalizeMerchant(raw: string): string {
  return normalizeText(raw)
    .toLowerCase()
    .replace(/[\s()[\]{}_\-./:,]+/g, " ")
    .trim();
}

function normalizeCurrency(raw: string): string {
  const normalized = normalizeText(raw);
  const upper = normalized.toUpperCase();

  if (normalized.includes("₩") || normalized.includes("원")) {
    return "KRW";
  }

  if (normalized.includes("$")) {
    return "USD";
  }

  if (normalized.includes("€")) {
    return "EUR";
  }

  if (normalized.includes("£")) {
    return "GBP";
  }

  if (normalized.includes("¥") || normalized.includes("￥")) {
    return "JPY";
  }

  return upper.replace(/\s/g, "");
}

function normalizeSourceText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function normalizeText(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function normalizeDecimal(raw: string): string {
  const compact = raw.normalize("NFKC").trim();

  if (compact === "") {
    return "0.00";
  }

  const sanitized = compact.replace(/[^\d.+\-()]/g, "");

  if (!/\d/.test(sanitized)) {
    return "0.00";
  }

  const isNegative = isNegativeToken(sanitized);
  const numericToken = sanitized.replace(/[()+-]/g, "");
  const parts = numericToken.split(".");

  if (parts.length > 2) {
    throw new Error(`Invalid decimal amount: ${raw}`);
  }

  const wholePart = parts[0] ?? "0";
  const fractionalPart = parts[1] ?? "";

  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) {
    throw new Error(`Invalid decimal amount: ${raw}`);
  }

  const wholeMinorUnits =
    BigInt(trimLeadingZeroes(wholePart) || "0") * MINOR_UNIT;
  const paddedFraction = `${fractionalPart}00`;
  const cents = BigInt(paddedFraction.slice(0, 2));
  const shouldRoundUp = (fractionalPart[2] ?? "0") >= "5";
  const absoluteMinorUnits =
    wholeMinorUnits + cents + (shouldRoundUp ? ONE_MINOR_UNIT : ZERO_MINOR_UNITS);

  if (absoluteMinorUnits === ZERO_MINOR_UNITS) {
    return "0.00";
  }

  const sign = isNegative ? "-" : "";
  const whole = absoluteMinorUnits / MINOR_UNIT;
  const fraction = absoluteMinorUnits % MINOR_UNIT;
  const fractionText = fraction < BigInt("10") ? `0${fraction}` : `${fraction}`;

  return `${sign}${whole}.${fractionText}`;
}

function isNegativeToken(token: string): boolean {
  const withoutWhitespace = token.replace(/\s/g, "");

  return (
    (withoutWhitespace.startsWith("(") && withoutWhitespace.endsWith(")")) ||
    withoutWhitespace.startsWith("-") ||
    withoutWhitespace.endsWith("-")
  );
}

function trimLeadingZeroes(value: string): string {
  return value.replace(/^0+/, "");
}
