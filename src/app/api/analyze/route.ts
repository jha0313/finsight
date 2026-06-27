import { NextResponse, type NextRequest } from "next/server";

import { parseCsvStatement } from "@/lib/csv";
import { runAnalyzeRequest } from "@/lib/orchestration";
import { extractPdfStatement, extractPdfText } from "@/lib/pdf";
import {
  createClaudeInsightProvider,
  createClaudePdfExtractor,
} from "@/services/claude";
import { createPostHogAnalytics } from "@/services/posthog/analytics";
import {
  createAiUsage,
  createStatementRepository,
  createSubscriptionGateway,
  getCurrentUser,
  runWithSubscriptionRequestCache,
} from "@/services/supabase";
import type { ParsedStatement } from "@/types/csv";
import type { AnalyticsPort } from "@/types/ports";

// PDF는 텍스트 추출 후 Claude 추출(Sonnet, 최대 60s) + 인사이트(Sonnet/Opus,
// 최대 60s)로 Claude를 두 번 순차로 거치므로, 저장 RPC 여유까지 더해 동기
// 처리 한도를 두 호출 합(120s) 위로 넉넉히 둔다.
export const maxDuration = 180;

type Upload =
  | { kind: "csv"; data: string | Buffer }
  | { kind: "pdf"; data: Buffer };

type FailureResponse = {
  status: 400 | 503;
  body: {
    error: "invalid_upload" | "analysis_unavailable";
    message: string;
  };
  phase: "upload" | "parse" | "pdf_extraction" | "analysis";
  reason: "empty_upload" | "invalid_statement" | "dependency_failure";
};

const PDF_MAGIC = "%PDF-";

class EmptyUploadError extends Error {
  constructor() {
    super("Empty upload");
    this.name = "EmptyUploadError";
  }
}

class UploadParseError extends Error {
  constructor() {
    super("Upload parse failed");
    this.name = "UploadParseError";
  }
}

class CsvParseError extends Error {
  constructor() {
    super("CSV parse failed");
    this.name = "CsvParseError";
  }
}

class PdfExtractionError extends Error {
  constructor() {
    super("PDF extraction failed");
    this.name = "PdfExtractionError";
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const analytics = createPostHogAnalytics();

  try {
    const upload = await readUpload(request);
    const statement = await toStatement(upload);
    const result = await runWithSubscriptionRequestCache(() =>
      runAnalyzeRequest({
        statement,
        deps: {
          getCurrentUser,
          subscriptionGateway: createSubscriptionGateway(),
          aiUsage: createAiUsage(),
          statementRepository: createStatementRepository(),
          insightProviderFactory: createClaudeInsightProvider,
          analytics,
        },
      }),
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const failure = classifyRouteFailure(error);

    captureRouteFailure(analytics, failure);

    return NextResponse.json(failure.body, { status: failure.status });
  } finally {
    // serverless(Vercel 람다) freeze 전에 emit된 서버 이벤트 전송을 보장한다.
    await analytics.flush();
  }
}

// composition root: 입력 형식별 파서를 골라 형식 무관한 ParsedStatement로
// 정규화한다. PDF 추출 어댑터(Claude)와 텍스트 추출(unpdf)은 여기서 주입한다.
async function toStatement(upload: Upload): Promise<ParsedStatement> {
  if (upload.kind === "pdf") {
    try {
      return await extractPdfStatement(upload.data, {
        extractText: extractPdfText,
        extractor: createClaudePdfExtractor(),
      });
    } catch {
      throw new PdfExtractionError();
    }
  }

  try {
    return parseCsvStatement(upload.data);
  } catch {
    throw new CsvParseError();
  }
}

async function readUpload(request: NextRequest): Promise<Upload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      throw new UploadParseError();
    }

    const uploaded = formData.get("file") ?? formData.get("csv");

    if (uploaded instanceof Blob) {
      const data = Buffer.from(await uploaded.arrayBuffer());
      const name = uploaded instanceof File ? uploaded.name : "";

      if (data.length === 0) {
        throw new EmptyUploadError();
      }

      return isPdfUpload(data, uploaded.type, name)
        ? { kind: "pdf", data }
        : { kind: "csv", data };
    }

    if (typeof uploaded === "string" && uploaded.trim() !== "") {
      return { kind: "csv", data: uploaded };
    }

    throw new EmptyUploadError();
  }

  const data = await request.text();

  if (data.trim() === "") {
    throw new EmptyUploadError();
  }

  return { kind: "csv", data };
}

function captureRouteFailure(
  analytics: AnalyticsPort,
  failure: FailureResponse,
): void {
  analytics.capture({
    distinctId: "anonymous",
    event: "analysis_failed",
    properties: {
      phase: failure.phase,
      reason: failure.reason,
      status: failure.status,
    },
  });
}

function classifyRouteFailure(error: unknown): FailureResponse {
  if (error instanceof EmptyUploadError) {
    return {
      status: 400,
      body: {
        error: "invalid_upload",
        message: "CSV 또는 PDF 명세서를 업로드해 주세요.",
      },
      phase: "upload",
      reason: "empty_upload",
    };
  }

  if (error instanceof UploadParseError) {
    return {
      status: 400,
      body: {
        error: "invalid_upload",
        message:
          "업로드된 파일을 읽을 수 없습니다. CSV/PDF 파일을 다시 선택해 주세요.",
      },
      phase: "upload",
      reason: "invalid_statement",
    };
  }

  if (error instanceof CsvParseError) {
    return {
      status: 400,
      body: {
        error: "invalid_upload",
        message: "명세서 형식을 읽을 수 없습니다. CSV/PDF 파일을 확인해 주세요.",
      },
      phase: "parse",
      reason: "invalid_statement",
    };
  }

  if (error instanceof PdfExtractionError) {
    return {
      status: 503,
      body: {
        error: "analysis_unavailable",
        message:
          "PDF 명세서 추출이 일시적으로 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      phase: "pdf_extraction",
      reason: "dependency_failure",
    };
  }

  return {
    status: 503,
    body: {
      error: "analysis_unavailable",
      message:
        "분석 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    },
    phase: "analysis",
    reason: "dependency_failure",
  };
}

// 확장자·MIME만 믿지 않고 매직 바이트(%PDF-)를 함께 본다(브라우저가 빈
// type을 보내거나 이름이 없는 경우에도 안전하게 판정).
function isPdfUpload(data: Buffer, type: string, name: string): boolean {
  if (type === "application/pdf") {
    return true;
  }

  if (name.toLowerCase().endsWith(".pdf")) {
    return true;
  }

  return data.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;
}
