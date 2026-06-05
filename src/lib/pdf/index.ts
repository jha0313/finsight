import { compareMoney, negateMoney, parseAmount } from "../money";
import { scrubIdentifiers } from "../mask";
import type { ParsedStatement, ParsedTransaction } from "@/types/csv";
import type { ExtractedTransaction } from "@/types/pdf";
import type { PdfTransactionExtractor } from "@/types/ports";

export const PDF_EXTRACTION_EMPTY_WARNING =
  "PDF에서 거래 단위를 추출하지 못했습니다.";
const PDF_TEXT_FAILED_WARNING = "PDF 텍스트를 읽지 못했습니다.";
const PDF_EXTRACTION_FAILED_WARNING =
  "PDF 거래 추출에 실패해 AI 분석을 건너뜁니다.";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ZERO_MONEY = "0.00";

export interface ExtractPdfStatementDeps {
  extractText: (data: Buffer) => Promise<string>;
  extractor: PdfTransactionExtractor;
}

// PDF 텍스트 추출 → 마스킹 → Claude 추출 → 정규화의 조합. 텍스트 추출과
// 추출 어댑터 실패는 모두 격리해, 규칙·통계 분석이 가능한 fallback statement로
// 변환한다(route가 statement status=failed로 저장하고 AI는 건너뛴다).
export async function extractPdfStatement(
  data: Buffer,
  deps: ExtractPdfStatementDeps,
): Promise<ParsedStatement> {
  let text: string;

  try {
    text = await deps.extractText(data);
  } catch {
    return fallbackStatement("", PDF_TEXT_FAILED_WARNING);
  }

  const masked = prepareStatementText(text);
  let extracted: ExtractedTransaction[];

  try {
    extracted = await deps.extractor.extract({ text: masked });
  } catch {
    return fallbackStatement(text, PDF_EXTRACTION_FAILED_WARNING);
  }

  return toParsedStatement(extracted, text);
}

// unpdf(pdf.js 기반, 서버리스 친화)로 텍스트 레이어를 단일 문자열로 추출한다.
// 동적 import로 무거운 PDF 런타임을 호출 시점까지 지연한다(키 없는 빌드·테스트
// 보호). 스캔(이미지) PDF는 텍스트 레이어가 없어 거의 빈 문자열을 반환한다.
export async function extractPdfText(data: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });

  return text;
}

// 추출 전 마스킹: 연속 7자리 이상 숫자(카드·계좌·전화·참조번호)를 끝 4자리만
// 남기고 가린다. 거래 날짜(MM/DD)·금액(2,400.00)은 자릿수가 짧아 보존된다.
export function prepareStatementText(text: string): string {
  return scrubIdentifiers(text);
}

export function toParsedStatement(
  extracted: ExtractedTransaction[],
  sourceText: string,
): ParsedStatement {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  for (const [index, item] of extracted.entries()) {
    const transaction = toParsedTransaction(item);

    if (transaction === null) {
      warnings.push(
        `Skipped extracted row ${index + 1}: invalid date, merchant, or amount.`,
      );
      continue;
    }

    transactions.push(transaction);
  }

  if (transactions.length === 0) {
    warnings.push(PDF_EXTRACTION_EMPTY_WARNING);

    return { transactions, warnings, needsFallback: true, sourceText };
  }

  return { transactions, warnings, needsFallback: false, sourceText };
}

function toParsedTransaction(
  item: ExtractedTransaction,
): ParsedTransaction | null {
  const date = item.date.trim();

  if (!ISO_DATE.test(date)) {
    return null;
  }

  const merchant = scrubIdentifiers(item.merchant.trim());

  if (merchant === "") {
    return null;
  }

  let signedAmount: string;

  try {
    signedAmount = signFor(item.direction, item.amount);
  } catch {
    return null;
  }

  return {
    date,
    merchant,
    signedAmount,
    direction: item.direction,
    currency: item.currency.trim().toUpperCase(),
  };
}

// 부호 규약(지출 양수/환불·결제 음수)을 결정론적으로 적용한다. Claude가
// 절대값을 주는 게 원칙이나, 부호가 섞여 와도 크기만 취해 일관되게 처리한다.
function signFor(direction: ParsedTransaction["direction"], amount: string): string {
  const magnitude = absMoney(parseAmount(amount));

  return direction === "debit" ? magnitude : negateMoney(magnitude);
}

function absMoney(value: string): string {
  return compareMoney(value, ZERO_MONEY) < 0 ? negateMoney(value) : value;
}

function fallbackStatement(
  sourceText: string,
  warning: string,
): ParsedStatement {
  return {
    transactions: [],
    warnings: [warning],
    needsFallback: true,
    sourceText,
  };
}
