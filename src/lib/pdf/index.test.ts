import { describe, expect, it, vi } from "vitest";

import type { PdfTransactionExtractor } from "@/types/ports";
import type { ExtractedTransaction } from "@/types/pdf";

import {
  PDF_EXTRACTION_EMPTY_WARNING,
  extractPdfStatement,
  prepareStatementText,
  toParsedStatement,
} from "./index";

function extracted(
  overrides: Partial<ExtractedTransaction>,
): ExtractedTransaction {
  return {
    date: "2026-05-13",
    merchant: "NETFLIX.COM",
    amount: "19.83",
    direction: "debit",
    currency: "USD",
    ...overrides,
  };
}

describe("prepareStatementText", () => {
  it("masks long embedded identifiers (cards, phone numbers) before extraction", () => {
    const text = [
      "Account Number: XXXX XXXX XXXX 6526",
      "Customer Service 1-800-493-3319",
      "41472027303165260000400000369270000000006",
    ].join("\n");

    const prepared = prepareStatementText(text);

    expect(prepared).not.toContain("8004933319");
    expect(prepared).not.toContain("41472027303165260000400000369270000000006");
    // 끝 4자리만 노출되는 마스킹 규약을 따른다.
    expect(prepared).toContain("0006");
  });

  it("preserves transaction dates and amounts", () => {
    const text = "04/13 HyundaiDepartmentStore SEOUL -162.51";

    const prepared = prepareStatementText(text);

    expect(prepared).toContain("04/13");
    expect(prepared).toContain("162.51");
  });
});

describe("toParsedStatement", () => {
  it("derives signedAmount from direction (debit positive, refund/credit negative)", () => {
    const statement = toParsedStatement(
      [
        extracted({ merchant: "STARBUCKS", amount: "25.00", direction: "debit" }),
        extracted({
          merchant: "Refund Store",
          amount: "31.08",
          direction: "refund",
        }),
        extracted({
          merchant: "Payment Thank You",
          amount: "2000.00",
          direction: "credit",
        }),
      ],
      "source text",
    );

    expect(statement.needsFallback).toBe(false);
    expect(statement.transactions).toEqual([
      {
        date: "2026-05-13",
        merchant: "STARBUCKS",
        signedAmount: "25.00",
        direction: "debit",
        currency: "USD",
      },
      {
        date: "2026-05-13",
        merchant: "Refund Store",
        signedAmount: "-31.08",
        direction: "refund",
        currency: "USD",
      },
      {
        date: "2026-05-13",
        merchant: "Payment Thank You",
        signedAmount: "-2000.00",
        direction: "credit",
        currency: "USD",
      },
    ]);
  });

  it("normalizes the amount magnitude even if the model emits a signed value", () => {
    const statement = toParsedStatement(
      [extracted({ amount: "-19.83", direction: "debit" })],
      "src",
    );

    expect(statement.transactions[0].signedAmount).toBe("19.83");
  });

  it("masks identifiers embedded in the merchant name", () => {
    const statement = toParsedStatement(
      [extracted({ merchant: "LYFT RIDE 8446261525" })],
      "src",
    );

    expect(statement.transactions[0].merchant).not.toContain("8446261525");
  });

  it("uppercases the currency code", () => {
    const statement = toParsedStatement(
      [extracted({ currency: "cad" })],
      "src",
    );

    expect(statement.transactions[0].currency).toBe("CAD");
  });

  it("skips rows with an invalid date or empty merchant and records a warning", () => {
    const statement = toParsedStatement(
      [
        extracted({ date: "May 13", merchant: "Bad Date" }),
        extracted({ merchant: "   " }),
        extracted({ merchant: "Valid" }),
      ],
      "src",
    );

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0].merchant).toBe("Valid");
    expect(statement.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("flags needsFallback when no transactions survive", () => {
    const statement = toParsedStatement([], "src");

    expect(statement.needsFallback).toBe(true);
    expect(statement.transactions).toEqual([]);
    expect(statement.warnings).toContain(PDF_EXTRACTION_EMPTY_WARNING);
  });
});

describe("extractPdfStatement", () => {
  it("extracts text, masks it, runs the extractor, and keeps raw text as sourceText", async () => {
    const rawText = "Card 4147202730316526 STARBUCKS 25.00";
    const extractText = vi.fn().mockResolvedValue(rawText);
    const extractor: PdfTransactionExtractor = {
      extract: vi.fn().mockResolvedValue([
        extracted({ merchant: "STARBUCKS", amount: "25.00" }),
      ]),
    };

    const statement = await extractPdfStatement(Buffer.from("pdf"), {
      extractText,
      extractor,
    });

    expect(extractText).toHaveBeenCalledOnce();
    // extractor에는 마스킹된 텍스트가 전달되어야 한다(원문 카드번호 금지).
    const maskedArg = (extractor.extract as ReturnType<typeof vi.fn>).mock
      .calls[0][0].text as string;
    expect(maskedArg).not.toContain("4147202730316526");
    // sourceHash 원본은 추출 원문을 그대로 보존한다.
    expect(statement.sourceText).toBe(rawText);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.needsFallback).toBe(false);
  });

  it("isolates extractor failures as a fallback statement without throwing", async () => {
    const extractText = vi.fn().mockResolvedValue("some statement text");
    const extractor: PdfTransactionExtractor = {
      extract: vi.fn().mockRejectedValue(new Error("Claude unavailable")),
    };

    const statement = await extractPdfStatement(Buffer.from("pdf"), {
      extractText,
      extractor,
    });

    expect(statement.needsFallback).toBe(true);
    expect(statement.transactions).toEqual([]);
    expect(statement.sourceText).toBe("some statement text");
  });
});
