import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProInsights } from "@/types/analysis";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

import { createClaudeInsightProvider } from "./index";

const anthropicMocks = vi.hoisted(() => {
  const parse = vi.fn();
  const Anthropic = vi.fn(function Anthropic() {
    return {
      messages: {
        parse,
      },
    };
  });

  return {
    Anthropic,
    parse,
  };
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: anthropicMocks.Anthropic,
}));

const PARSED_OUTPUT: ProInsights = {
  summary: "이번 달 지출은 식비와 교통비 중심으로 증가했습니다.",
  insights: ["반복 결제 후보를 점검하세요."],
};

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    date: overrides.date ?? "2026-06-01",
    merchant: overrides.merchant ?? "스타벅스 강남점",
    signedAmount: overrides.signedAmount ?? "5500.00",
    direction: overrides.direction ?? "debit",
    category: overrides.category ?? "food",
    currency: overrides.currency ?? "KRW",
    maskedAccount: overrides.maskedAccount ?? "**** **** **** 3456",
    rowHash: overrides.rowHash ?? "row-hash-with-sensitive-source",
  };
}

function parseRequest() {
  return anthropicMocks.parse.mock.calls.at(-1)?.[0];
}

function parseOptions() {
  return anthropicMocks.parse.mock.calls.at(-1)?.[1];
}

async function generate(tier: Tier = "free", transactions = [transaction()]) {
  const provider = createClaudeInsightProvider();

  return provider.generate({
    transactions,
    tier,
  });
}

describe("createClaudeInsightProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    anthropicMocks.parse.mockResolvedValue({
      parsed_output: PARSED_OUTPUT,
    });
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("creates the Anthropic client lazily when generate is called", async () => {
    const provider = createClaudeInsightProvider();

    expect(anthropicMocks.Anthropic).not.toHaveBeenCalled();

    await provider.generate({
      transactions: [transaction()],
      tier: "free",
    });

    expect(anthropicMocks.Anthropic).toHaveBeenCalledTimes(1);
  });

  it("routes free tier requests to Sonnet structured outputs", async () => {
    await generate("free");

    const request = parseRequest();

    expect(request?.model).toBe("claude-sonnet-4-6");
    expect(request?.output_config?.format).toMatchObject({
      type: "json_schema",
    });
    expect(typeof request?.output_config?.format?.parse).toBe("function");
  });

  it("routes pro tier requests to Opus", async () => {
    await generate("pro");

    expect(parseRequest()?.model).toBe("claude-opus-4-8");
  });

  it("sends only masked transaction analysis fields to Claude", async () => {
    await generate("pro", [
      transaction({
        merchant: "Netflix",
        maskedAccount: "**** **** **** 9999",
        rowHash: "hash-derived-from-full-card-number",
      }),
    ]);

    const request = parseRequest();
    const payload = JSON.parse(request?.messages[0].content as string);
    const serializedRequest = JSON.stringify(request);

    expect(payload.transactions).toEqual([
      {
        date: "2026-06-01",
        merchant: "Netflix",
        amount: "5500.00",
        category: "food",
      },
    ]);
    expect(Object.keys(payload.transactions[0]).sort()).toEqual([
      "amount",
      "category",
      "date",
      "merchant",
    ]);
    expect(serializedRequest).not.toContain("maskedAccount");
    expect(serializedRequest).not.toContain("**** **** **** 9999");
    expect(serializedRequest).not.toContain("rowHash");
    expect(serializedRequest).not.toContain("hash-derived-from-full-card-number");
    expect(serializedRequest).not.toContain("currency");
  });

  it("caps large transaction payloads before sending them to Claude", async () => {
    const transactions = Array.from({ length: 205 }, (_, index) =>
      transaction({
        date: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
        merchant: `merchant-${index}`,
        signedAmount: `${index + 1}.00`,
        rowHash: `row-${index}`,
      }),
    );

    await generate("free", transactions);

    const payload = JSON.parse(parseRequest()?.messages[0].content as string);

    expect(payload.transactions).toHaveLength(200);
    expect(payload.totalTransactions).toBe(205);
    expect(payload.includedTransactions).toBe(200);
    expect(payload.omittedTransactions).toBe(5);
    expect(payload.transactions[199]).toEqual({
      date: "2026-06-04",
      merchant: "merchant-199",
      amount: "200.00",
      category: "food",
    });
  });

  it("sets a 30 second SDK timeout and returns parsed output", async () => {
    const result = await generate("free");

    expect(parseOptions()).toMatchObject({
      timeout: 30000,
      maxRetries: 0,
    });
    expect(result).toEqual(PARSED_OUTPUT);
  });

  it("throws when the SDK call fails or times out", async () => {
    anthropicMocks.parse.mockRejectedValueOnce(new Error("request timeout"));

    await expect(generate("pro")).rejects.toThrow("request timeout");
  });

  it("throws when Claude returns no parsed output", async () => {
    anthropicMocks.parse.mockResolvedValueOnce({
      parsed_output: null,
    });

    await expect(generate("free")).rejects.toThrow("parsed output");
  });
});
