import { createHash } from "node:crypto";

import { formatMinorUnits, parseMinorUnits } from "../money";
import type { ParsedTransaction } from "@/types/csv";

const HASH_VERSION = "mask:v1";
const MASK_GROUP = "****";
const IDENTIFIER_VISIBLE_CHARS = 4;
const IDENTIFIER_GROUP_SIZE = 4;
const EMBEDDED_IDENTIFIER = /\d[\d\s-]*\d/g;
const MIN_EMBEDDED_IDENTIFIER_DIGITS = 7;

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

// 가맹점명/적요 같은 자유 텍스트에 임베드된 계좌·카드·전화번호(연속 7자리
// 이상)를 적재 전에 마스킹한다. 짧은 매장코드(예: 1234점)는 보존한다.
export function scrubIdentifiers(text: string): string {
  return text.replace(EMBEDDED_IDENTIFIER, (match) => {
    const digits = match.replace(/\D/g, "");

    return digits.length >= MIN_EMBEDDED_IDENTIFIER_DIGITS
      ? maskAccount(match)
      : match;
  });
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

// 금액 정규화는 money 모듈의 로케일 인식 파서를 단일 출처로 재사용한다.
// (dedup/cache 해시가 분석 금액과 동일한 규칙을 따르도록 보장)
function normalizeDecimal(raw: string): string {
  return formatMinorUnits(parseMinorUnits(raw));
}
