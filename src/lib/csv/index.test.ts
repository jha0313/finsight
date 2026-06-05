import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { mapColumns, parseCsv, parseCsvStatement } from "./index";

describe("mapColumns", () => {
  it("maps Korean and English header aliases to canonical fields", () => {
    expect(
      mapColumns(["거래일시", "사용처", "이용금액", "계좌번호"]).columns,
    ).toMatchObject({
      date: "거래일시",
      merchant: "사용처",
      amount: "이용금액",
      account: "계좌번호",
    });

    expect(
      mapColumns([
        "Transaction Date",
        "Description",
        "Amount",
        "Currency",
        "Account Number",
      ]).columns,
    ).toMatchObject({
      date: "Transaction Date",
      merchant: "Description",
      amount: "Amount",
      currency: "Currency",
      account: "Account Number",
    });
  });
});

describe("parseCsv", () => {
  it("parses a single amount column with normalized dates and signed amounts", () => {
    const result = parseCsv(`날짜,가맹점,금액,통화,카드번호
2026.06.01,스타벅스,"₩5,500",KRW,1234-5678-9012-3456
2026/06/02,환불,"(1,000)",KRW,1234-5678-9012-3456`);

    expect(result.needsFallback).toBe(false);
    expect(result.transactions).toEqual([
      {
        date: "2026-06-01",
        merchant: "스타벅스",
        signedAmount: "5500.00",
        direction: "debit",
        currency: "KRW",
        account: "1234-5678-9012-3456",
      },
      {
        date: "2026-06-02",
        merchant: "환불",
        signedAmount: "-1000.00",
        direction: "refund",
        currency: "KRW",
        account: "1234-5678-9012-3456",
      },
    ]);
  });

  it("parses debit and credit columns using spend-positive convention", () => {
    const result = parseCsv(`거래일,내용,출금액,입금액
2026-06-01,편의점,"2,300",
06/02/2026,급여,,"2,000,000"`);

    expect(result.needsFallback).toBe(false);
    expect(result.transactions).toEqual([
      {
        date: "2026-06-01",
        merchant: "편의점",
        signedAmount: "2300.00",
        direction: "debit",
        currency: "KRW",
      },
      {
        date: "2026-06-02",
        merchant: "급여",
        signedAmount: "-2000000.00",
        direction: "credit",
        currency: "KRW",
      },
    ]);
  });

  it("filters total, subtotal, cumulative, and dateless summary rows", () => {
    const result = parseCsv(`date,merchant,amount
2026-06-01,Cafe,1000
,소계,1000
2026-06-02,Total,2000
2026-06-03,누계,3000
2026-06-04,Bookstore,4000`);

    expect(result.transactions.map((transaction) => transaction.merchant)).toEqual([
      "Cafe",
      "Bookstore",
    ]);
  });

  it("keeps merchant names that contain summary keywords as substrings", () => {
    const result = parseCsv(`date,merchant,amount
2026-06-01,종합계좌이체,1000
2026-06-02,소계,2000
2026-06-03,누계관리,3000`);

    expect(result.transactions.map((transaction) => transaction.merchant)).toEqual([
      "종합계좌이체",
      "누계관리",
    ]);
  });

  it("masks account and card numbers embedded in merchant cells", () => {
    const result = parseCsv(`date,merchant,amount
2026-06-01,홍길동 110-123-456789 이체,10000`);

    expect(result.transactions[0].merchant).toBe("홍길동 **** **** 6789 이체");
  });

  it("skips rows with malformed amounts instead of failing the whole parse", () => {
    const result = parseCsv(`date,merchant,amount
2026-06-01,Cafe,1.2.3
2026-06-02,Bookstore,5000`);

    expect(result.transactions.map((transaction) => transaction.merchant)).toEqual([
      "Bookstore",
    ]);
    expect(
      result.warnings.some((warning) => warning.includes("invalid amount")),
    ).toBe(true);
  });

  it("parses European decimal-comma amounts in CSV cells", () => {
    const result = parseCsv(`date,merchant,amount,currency
2026-06-01,Café,"1.234,56",EUR`);

    expect(result.transactions[0]).toMatchObject({
      signedAmount: "1234.56",
      currency: "EUR",
    });
  });

  it("delegates quoted comma tokenization to the CSV parser", () => {
    const result = parseCsv(`date,merchant,amount,currency
2026-06-01,"Amazon, Marketplace","$1,234.56",USD`);

    expect(result.transactions).toEqual([
      {
        date: "2026-06-01",
        merchant: "Amazon, Marketplace",
        signedAmount: "1234.56",
        direction: "debit",
        currency: "USD",
      },
    ]);
  });

  it("strips UTF-8 BOM before header mapping", () => {
    const result = parseCsv("\uFEFF일자,적요,거래금액\n2026.06.01,택시,18000");

    expect(result.needsFallback).toBe(false);
    expect(result.mapping.columns).toMatchObject({
      date: "일자",
      merchant: "적요",
      amount: "거래금액",
    });
    expect(result.transactions[0]).toMatchObject({
      date: "2026-06-01",
      merchant: "택시",
      signedAmount: "18000.00",
    });
  });

  it("decodes cp949/euc-kr encoded CSV buffers when encoding is provided", () => {
    const csv = `날짜,가맹점,금액\n2026-06-01,스타벅스,5500`;
    const buffer = iconv.encode(csv, "cp949");

    const result = parseCsv(buffer, { encoding: "cp949" });

    expect(result.needsFallback).toBe(false);
    expect(result.transactions[0]).toMatchObject({
      merchant: "스타벅스",
      signedAmount: "5500.00",
    });
  });

  it("falls back when a non-UTF8 buffer is decoded without an encoding hint", () => {
    const csv = `날짜,가맹점,금액\n2026-06-01,스타벅스,5500`;
    const buffer = iconv.encode(csv, "cp949");

    const result = parseCsv(buffer);

    expect(result.needsFallback).toBe(true);
  });

  it("returns needsFallback without parsing when standard mapping fails", () => {
    const result = parseCsv(`foo,bar
one,two`);

    expect(result.needsFallback).toBe(true);
    expect(result.transactions).toEqual([]);
    expect(result.warnings).toContain(
      "Standard CSV mapping failed; Claude fallback mapping is required.",
    );
  });
});

describe("parseCsvStatement", () => {
  it("wraps parseCsv output as a ParsedStatement carrying the source text", () => {
    const csv = `date,merchant,amount
2026-06-01,스타벅스,5500`;

    const statement = parseCsvStatement(csv);

    expect(statement.needsFallback).toBe(false);
    expect(statement.warnings).toEqual([]);
    expect(statement.sourceText).toBe(csv);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]).toMatchObject({
      merchant: "스타벅스",
      signedAmount: "5500.00",
      direction: "debit",
    });
  });

  it("decodes a buffer source to utf8 text for hashing", () => {
    const csv = `date,merchant,amount
2026-06-01,서점,12000`;

    const statement = parseCsvStatement(Buffer.from(csv, "utf8"));

    expect(statement.sourceText).toBe(csv);
  });
});
