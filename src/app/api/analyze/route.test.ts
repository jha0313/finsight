import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST, maxDuration } from "./route";

const analyzeRouteMocks = vi.hoisted(() => {
  const createAiUsage = vi.fn();
  const createClaudeInsightProvider = vi.fn();
  const createClaudePdfExtractor = vi.fn();
  const createStatementRepository = vi.fn();
  const createSubscriptionGateway = vi.fn();
  const getCurrentUser = vi.fn();
  const runAnalyzeRequest = vi.fn();
  const extractPdfStatement = vi.fn();
  const extractPdfText = vi.fn();
  const analytics = {
    capture: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  };
  const createPostHogAnalytics = vi.fn(() => analytics);

  return {
    createAiUsage,
    createClaudeInsightProvider,
    createClaudePdfExtractor,
    createStatementRepository,
    createSubscriptionGateway,
    getCurrentUser,
    runAnalyzeRequest,
    extractPdfStatement,
    extractPdfText,
    createPostHogAnalytics,
  };
});

vi.mock("@/lib/orchestration", () => ({
  runAnalyzeRequest: analyzeRouteMocks.runAnalyzeRequest,
}));

vi.mock("@/lib/pdf", () => ({
  extractPdfStatement: analyzeRouteMocks.extractPdfStatement,
  extractPdfText: analyzeRouteMocks.extractPdfText,
}));

vi.mock("@/services/claude", () => ({
  createClaudeInsightProvider: analyzeRouteMocks.createClaudeInsightProvider,
  createClaudePdfExtractor: analyzeRouteMocks.createClaudePdfExtractor,
}));

vi.mock("@/services/supabase", () => ({
  createAiUsage: analyzeRouteMocks.createAiUsage,
  createStatementRepository: analyzeRouteMocks.createStatementRepository,
  createSubscriptionGateway: analyzeRouteMocks.createSubscriptionGateway,
  getCurrentUser: analyzeRouteMocks.getCurrentUser,
}));

vi.mock("@/services/posthog/analytics", () => ({
  createPostHogAnalytics: analyzeRouteMocks.createPostHogAnalytics,
}));

const ANALYZE_RESPONSE = {
  tier: "free",
  free: {
    byCategory: [],
    trend: [],
    anomalies: [],
  },
  pro: {
    status: "locked",
  },
};

describe("analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeRouteMocks.createAiUsage.mockReturnValue({ kind: "usage" });
    analyzeRouteMocks.createClaudeInsightProvider.mockReturnValue({
      kind: "claude-provider",
    });
    analyzeRouteMocks.createStatementRepository.mockReturnValue({
      kind: "repository",
    });
    analyzeRouteMocks.createSubscriptionGateway.mockReturnValue({
      kind: "gateway",
    });
    analyzeRouteMocks.createClaudePdfExtractor.mockReturnValue({
      kind: "pdf-extractor",
    });
    analyzeRouteMocks.runAnalyzeRequest.mockResolvedValue({
      status: 200,
      body: ANALYZE_RESPONSE,
    });
  });

  it("raises route maxDuration for synchronous extraction + Opus latency", () => {
    expect(maxDuration).toBe(180);
  });

  it("passes raw CSV body to the testable analyze handler with lazy adapters", async () => {
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: "date,merchant,amount\n2026-06-01,스타벅스,5500",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ANALYZE_RESPONSE);
    expect(analyzeRouteMocks.runAnalyzeRequest).toHaveBeenCalledTimes(1);
    const call = analyzeRouteMocks.runAnalyzeRequest.mock.calls[0][0];
    expect(call.statement.sourceText).toBe(
      "date,merchant,amount\n2026-06-01,스타벅스,5500",
    );
    expect(call.statement.needsFallback).toBe(false);
    expect(call.statement.transactions).toHaveLength(1);
    expect(analyzeRouteMocks.extractPdfStatement).not.toHaveBeenCalled();
    expect(call.deps).toMatchObject({
      getCurrentUser: analyzeRouteMocks.getCurrentUser,
      aiUsage: { kind: "usage" },
      statementRepository: { kind: "repository" },
      subscriptionGateway: { kind: "gateway" },
    });
    expect(analyzeRouteMocks.createClaudeInsightProvider).not.toHaveBeenCalled();

    expect(call.deps.insightProviderFactory()).toEqual({
      kind: "claude-provider",
    });
    expect(analyzeRouteMocks.createClaudeInsightProvider).toHaveBeenCalledTimes(
      1,
    );
  });

  it("passes multipart uploaded CSV files without reading a request tier", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["date,merchant,amount\n2026-06-01,서점,12000"], {
        type: "text/csv",
      }),
      "statement.csv",
    );
    formData.set("tier", "pro");
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: formData,
    });

    await POST(request);

    const call = analyzeRouteMocks.runAnalyzeRequest.mock.calls[0][0];
    expect(call.statement.sourceText).toBe(
      "date,merchant,amount\n2026-06-01,서점,12000",
    );
    expect(call.statement.transactions[0]).toMatchObject({ merchant: "서점" });
    expect(call).not.toHaveProperty("csv");
    expect(call).not.toHaveProperty("tier");
  });

  it("routes PDF uploads through the unpdf reader and Claude extractor", async () => {
    const pdfStatement = {
      transactions: [
        {
          date: "2026-05-13",
          merchant: "NETFLIX.COM",
          signedAmount: "19.83",
          direction: "debit",
          currency: "USD",
        },
      ],
      warnings: [],
      needsFallback: false,
      sourceText: "extracted pdf text",
    };
    analyzeRouteMocks.extractPdfStatement.mockResolvedValue(pdfStatement);

    const formData = new FormData();
    formData.set(
      "file",
      new Blob([Buffer.from("%PDF-1.4 fake statement bytes")], {
        type: "application/pdf",
      }),
      "May 19, 2026.pdf",
    );
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: formData,
    });

    await POST(request);

    expect(analyzeRouteMocks.createClaudePdfExtractor).toHaveBeenCalledTimes(1);
    expect(analyzeRouteMocks.extractPdfStatement).toHaveBeenCalledTimes(1);
    // PDF 추출 어댑터에는 텍스트 추출 함수와 Claude 추출기가 주입된다.
    const extractCall = analyzeRouteMocks.extractPdfStatement.mock.calls[0];
    expect(Buffer.isBuffer(extractCall[0])).toBe(true);
    expect(extractCall[1]).toMatchObject({
      extractText: analyzeRouteMocks.extractPdfText,
      extractor: { kind: "pdf-extractor" },
    });
    const call = analyzeRouteMocks.runAnalyzeRequest.mock.calls[0][0];
    expect(call.statement).toBe(pdfStatement);
  });

  it("detects PDF by magic bytes even without a pdf MIME type", async () => {
    analyzeRouteMocks.extractPdfStatement.mockResolvedValue({
      transactions: [],
      warnings: [],
      needsFallback: true,
      sourceText: "",
    });

    const formData = new FormData();
    formData.set(
      "file",
      new Blob([Buffer.from("%PDF-1.7 binary")], {
        type: "application/octet-stream",
      }),
      "statement",
    );
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: formData,
    });

    await POST(request);

    expect(analyzeRouteMocks.extractPdfStatement).toHaveBeenCalledTimes(1);
  });

  it("returns 400 and flushes analytics for an empty upload", async () => {
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: "   ",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_upload",
      message: "CSV 또는 PDF 명세서를 업로드해 주세요.",
    });
    expect(analyzeRouteMocks.runAnalyzeRequest).not.toHaveBeenCalled();
    expect(analyzeRouteMocks.createPostHogAnalytics).toHaveBeenCalledTimes(1);
    const analytics = analyzeRouteMocks.createPostHogAnalytics.mock.results[0]
      .value;
    expect(analytics.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "analysis_failed",
      properties: { phase: "upload", reason: "empty_upload", status: 400 },
    });
    expect(analytics.flush).toHaveBeenCalledTimes(1);
  });

  it("returns 400 and skips analysis when CSV parsing fails", async () => {
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: 'date,merchant,amount\n2026-06-01,"unterminated,1000',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_upload",
      message: "명세서 형식을 읽을 수 없습니다. CSV/PDF 파일을 확인해 주세요.",
    });
    expect(analyzeRouteMocks.runAnalyzeRequest).not.toHaveBeenCalled();
    const analytics = analyzeRouteMocks.createPostHogAnalytics.mock.results[0]
      .value;
    expect(analytics.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "analysis_failed",
      properties: { phase: "parse", reason: "invalid_statement", status: 400 },
    });
    expect(analytics.flush).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when multipart upload parsing fails", async () => {
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=broken-boundary",
      },
      body: "not a valid multipart body",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_upload",
      message: "업로드된 파일을 읽을 수 없습니다. CSV/PDF 파일을 다시 선택해 주세요.",
    });
    expect(analyzeRouteMocks.runAnalyzeRequest).not.toHaveBeenCalled();
    const analytics = analyzeRouteMocks.createPostHogAnalytics.mock.results[0]
      .value;
    expect(analytics.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "analysis_failed",
      properties: { phase: "upload", reason: "invalid_statement", status: 400 },
    });
    expect(analytics.flush).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and flushes analytics when PDF extraction fails", async () => {
    analyzeRouteMocks.extractPdfStatement.mockRejectedValue(
      new Error("Claude PDF extraction timed out"),
    );
    const formData = new FormData();
    formData.set(
      "file",
      new Blob([Buffer.from("%PDF-1.7 binary")], {
        type: "application/pdf",
      }),
      "statement.pdf",
    );
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "analysis_unavailable",
      message: "PDF 명세서 추출이 일시적으로 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(analyzeRouteMocks.runAnalyzeRequest).not.toHaveBeenCalled();
    const analytics = analyzeRouteMocks.createPostHogAnalytics.mock.results[0]
      .value;
    expect(analytics.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "analysis_failed",
      properties: { phase: "pdf_extraction", reason: "dependency_failure", status: 503 },
    });
    expect(analytics.flush).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and flushes analytics when analysis dependencies fail", async () => {
    analyzeRouteMocks.runAnalyzeRequest.mockRejectedValue(
      new Error("Supabase RPC failed"),
    );
    const request = new NextRequest("https://finsight.test/api/analyze", {
      method: "POST",
      body: "date,merchant,amount\n2026-06-01,서점,12000",
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "analysis_unavailable",
      message: "분석 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
    const analytics = analyzeRouteMocks.createPostHogAnalytics.mock.results[0]
      .value;
    expect(analytics.capture).toHaveBeenCalledWith({
      distinctId: "anonymous",
      event: "analysis_failed",
      properties: { phase: "analysis", reason: "dependency_failure", status: 503 },
    });
    expect(analytics.flush).toHaveBeenCalledTimes(1);
  });
});
