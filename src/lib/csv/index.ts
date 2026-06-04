import iconv from "iconv-lite";
import { parse as parseRecords } from "csv-parse/sync";

import { deriveSignedAmount } from "../money";
import type {
  CanonicalField,
  CsvMapping,
  ParseResult,
  ParsedTransaction,
} from "@/types/csv";

const FALLBACK_WARNING =
  "Standard CSV mapping failed; Claude fallback mapping is required.";
const DEFAULT_CURRENCY = "KRW";

const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  date: [
    "date",
    "transactiondate",
    "posteddate",
    "postingdate",
    "usedate",
    "거래일시",
    "거래일자",
    "거래일",
    "사용일자",
    "승인일자",
    "일자",
    "날짜",
  ],
  merchant: [
    "merchant",
    "description",
    "memo",
    "payee",
    "vendor",
    "store",
    "details",
    "merchantname",
    "가맹점",
    "내용",
    "적요",
    "거래처",
    "사용처",
    "상호",
    "이용처",
  ],
  amount: [
    "amount",
    "transactionamount",
    "chargeamount",
    "totalamount",
    "금액",
    "거래금액",
    "이용금액",
    "결제금액",
    "승인금액",
    "청구금액",
    "사용금액",
  ],
  debit: [
    "debit",
    "withdrawal",
    "withdrawals",
    "withdrawalamount",
    "paidout",
    "outflow",
    "expense",
    "출금",
    "출금액",
    "출금금액",
    "지출",
    "지급액",
  ],
  credit: [
    "credit",
    "deposit",
    "deposits",
    "depositamount",
    "paidin",
    "inflow",
    "income",
    "입금",
    "입금액",
    "입금금액",
  ],
  currency: ["currency", "curr", "통화", "통화코드"],
  account: [
    "account",
    "accountnumber",
    "card",
    "cardnumber",
    "계좌",
    "계좌번호",
    "카드",
    "카드번호",
  ],
};

const SUMMARY_KEYWORDS_KO = ["합계", "소계", "누계", "총계"];
const SUMMARY_KEYWORDS_EN = new Set([
  "total",
  "subtotal",
  "grandtotal",
  "sum",
]);

export function mapColumns(headers: string[]): CsvMapping {
  const columns = emptyColumns();
  const usedHeaderIndexes = new Set<number>();

  for (const field of [
    "date",
    "merchant",
    "debit",
    "credit",
    "amount",
    "currency",
    "account",
  ] satisfies CanonicalField[]) {
    const index = findHeaderIndex(headers, field, usedHeaderIndexes);

    if (index !== null) {
      columns[field] = headers[index];
      usedHeaderIndexes.add(index);
    }
  }

  return {
    columns,
    source: "standard",
  };
}

export function parseCsv(
  input: string | Buffer,
  opts: { encoding?: string } = {},
): ParseResult {
  const text = decodeInput(input, opts.encoding);
  const rows = parseCsvRows(text);
  const headers = rows[0] ?? [];
  const mapping = mapColumns(headers);
  const warnings: string[] = [];

  if (headers.length === 0 || !hasRequiredMapping(mapping)) {
    return fallbackResult(mapping);
  }

  const transactions: ParsedTransaction[] = [];

  for (const [index, cells] of rows.slice(1).entries()) {
    const rowNumber = index + 2;

    if (isEmptyRow(cells) || isSummaryRow(cells)) {
      continue;
    }

    const row = rowFromCells(headers, cells);
    const rawDate = readMappedCell(row, mapping, "date");
    const date = normalizeDate(rawDate);

    if (date === null) {
      warnings.push(`Skipped row ${rowNumber}: missing or invalid date.`);
      continue;
    }

    const merchant = readMappedCell(row, mapping, "merchant").trim();

    if (merchant === "") {
      warnings.push(`Skipped row ${rowNumber}: missing merchant.`);
      continue;
    }

    if (!hasAmountInput(row, mapping)) {
      warnings.push(`Skipped row ${rowNumber}: missing amount.`);
      continue;
    }

    const amountInput = {
      amount: readMappedCell(row, mapping, "amount"),
      debit: readMappedCell(row, mapping, "debit"),
      credit: readMappedCell(row, mapping, "credit"),
    };
    const signed = deriveSignedAmount(amountInput);
    const account = readMappedCell(row, mapping, "account").trim();
    const transaction: ParsedTransaction = {
      date,
      merchant,
      signedAmount: signed.signedAmount,
      direction: signed.direction,
      currency: resolveCurrency(row, mapping, amountInput),
    };

    if (account !== "") {
      transaction.account = account;
    }

    transactions.push(transaction);
  }

  return {
    transactions,
    mapping,
    warnings,
    needsFallback: false,
  };
}

function parseCsvRows(text: string): string[][] {
  const records = parseRecords(text, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as unknown[][];

  return records.map((row) => row.map((cell) => String(cell ?? "")));
}

function decodeInput(input: string | Buffer, encoding = "utf-8"): string {
  const decoded =
    typeof input === "string"
      ? input
      : iconv.decode(input, normalizeEncoding(encoding));

  return decoded.replace(/^\uFEFF/, "");
}

function normalizeEncoding(encoding: string): string {
  const normalized = encoding.toLowerCase().replace(/[_\s]/g, "-");

  if (normalized === "cp949" || normalized === "euc-kr") {
    return normalized;
  }

  return "utf-8";
}

function emptyColumns(): Record<CanonicalField, string | null> {
  return {
    date: null,
    merchant: null,
    amount: null,
    debit: null,
    credit: null,
    currency: null,
    account: null,
  };
}

function findHeaderIndex(
  headers: string[],
  field: CanonicalField,
  usedHeaderIndexes: Set<number>,
): number | null {
  const aliases = HEADER_ALIASES[field];

  for (const [index, header] of headers.entries()) {
    if (usedHeaderIndexes.has(index)) {
      continue;
    }

    if (matchesHeader(header, aliases)) {
      return index;
    }
  }

  return null;
}

function matchesHeader(header: string, aliases: string[]): boolean {
  const normalizedHeader = normalizeHeader(header);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeHeader(alias);

    return (
      normalizedHeader === normalizedAlias ||
      normalizedHeader.includes(normalizedAlias)
    );
  });
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s()[\]{}_\-./:]/g, "");
}

function hasRequiredMapping(mapping: CsvMapping): boolean {
  const columns = mapping.columns;
  const hasMoneyColumn =
    columns.amount !== null || columns.debit !== null || columns.credit !== null;

  return columns.date !== null && columns.merchant !== null && hasMoneyColumn;
}

function fallbackResult(mapping: CsvMapping): ParseResult {
  return {
    transactions: [],
    mapping,
    warnings: [FALLBACK_WARNING],
    needsFallback: true,
  };
}

function rowFromCells(
  headers: string[],
  cells: string[],
): Record<string, string> {
  const row: Record<string, string> = {};

  headers.forEach((header, index) => {
    row[header] = cells[index] ?? "";
  });

  return row;
}

function readMappedCell(
  row: Record<string, string>,
  mapping: CsvMapping,
  field: CanonicalField,
): string {
  const header = mapping.columns[field];

  if (header === null) {
    return "";
  }

  return row[header] ?? "";
}

function hasAmountInput(
  row: Record<string, string>,
  mapping: CsvMapping,
): boolean {
  return (
    hasMappedValue(row, mapping, "amount") ||
    hasMappedValue(row, mapping, "debit") ||
    hasMappedValue(row, mapping, "credit")
  );
}

function hasMappedValue(
  row: Record<string, string>,
  mapping: CsvMapping,
  field: CanonicalField,
): boolean {
  return readMappedCell(row, mapping, field).trim() !== "";
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

function isSummaryRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const compact = normalizeSummaryCell(cell);

    if (compact === "") {
      return false;
    }

    return (
      SUMMARY_KEYWORDS_KO.some((keyword) => compact.includes(keyword)) ||
      SUMMARY_KEYWORDS_EN.has(compact)
    );
  });
}

function normalizeSummaryCell(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[\s()[\]{}_\-./:]/g, "");
}

function normalizeDate(raw: string): string | null {
  const text = raw.trim();

  if (text === "") {
    return null;
  }

  const koreanMatch = text.match(
    /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
  );

  if (koreanMatch !== null) {
    return formatDateParts(koreanMatch[1], koreanMatch[2], koreanMatch[3]);
  }

  const ymdMatch = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);

  if (ymdMatch !== null) {
    return formatDateParts(ymdMatch[1], ymdMatch[2], ymdMatch[3]);
  }

  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (compactMatch !== null) {
    return formatDateParts(
      compactMatch[1],
      compactMatch[2],
      compactMatch[3],
    );
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if (slashMatch !== null) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = normalizeYear(slashMatch[3]);

    if (first > 12 && second <= 12) {
      return formatDateParts(year, slashMatch[2], slashMatch[1]);
    }

    return formatDateParts(year, slashMatch[1], slashMatch[2]);
  }

  return null;
}

function formatDateParts(
  yearToken: string,
  monthToken: string,
  dayToken: string,
): string | null {
  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);

  if (!isValidDatePart(year, month, day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearToken.padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function normalizeYear(yearToken: string): string {
  if (yearToken.length === 2) {
    return `20${yearToken}`;
  }

  return yearToken;
}

function isValidDatePart(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1900 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  );
}

function resolveCurrency(
  row: Record<string, string>,
  mapping: CsvMapping,
  amountInput: { amount: string; debit: string; credit: string },
): string {
  const currency = readMappedCell(row, mapping, "currency").trim();

  if (currency !== "") {
    return normalizeCurrency(currency);
  }

  return inferCurrencyFromAmountCells(Object.values(amountInput)) ?? DEFAULT_CURRENCY;
}

function normalizeCurrency(raw: string): string {
  const compact = raw.trim();
  const upper = compact.toUpperCase();

  if (compact.includes("₩") || compact.includes("원") || upper === "KRW") {
    return "KRW";
  }

  if (compact.includes("$") || upper === "USD") {
    return "USD";
  }

  if (compact.includes("€") || upper === "EUR") {
    return "EUR";
  }

  if (compact.includes("£") || upper === "GBP") {
    return "GBP";
  }

  if (compact.includes("¥") || compact.includes("￥") || upper === "JPY") {
    return "JPY";
  }

  return upper;
}

function inferCurrencyFromAmountCells(cells: string[]): string | null {
  const joined = cells.join(" ");

  if (joined.includes("₩") || joined.includes("원")) {
    return "KRW";
  }

  if (joined.includes("$")) {
    return "USD";
  }

  if (joined.includes("€")) {
    return "EUR";
  }

  if (joined.includes("£")) {
    return "GBP";
  }

  if (joined.includes("¥") || joined.includes("￥")) {
    return "JPY";
  }

  return null;
}
