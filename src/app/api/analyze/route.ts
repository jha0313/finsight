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
} from "@/services/supabase";
import type { ParsedStatement } from "@/types/csv";

// PDF는 텍스트 추출 후 Claude 추출(Sonnet, 최대 60s) + 인사이트(Sonnet/Opus,
// 최대 60s)로 Claude를 두 번 순차로 거치므로, 저장 RPC 여유까지 더해 동기
// 처리 한도를 두 호출 합(120s) 위로 넉넉히 둔다.
export const maxDuration = 180;

type Upload =
  | { kind: "csv"; data: string | Buffer }
  | { kind: "pdf"; data: Buffer };

const PDF_MAGIC = "%PDF-";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const upload = await readUpload(request);
  const statement = await toStatement(upload);
  const analytics = createPostHogAnalytics();
  const result = await runAnalyzeRequest({
    statement,
    deps: {
      getCurrentUser,
      subscriptionGateway: createSubscriptionGateway(),
      aiUsage: createAiUsage(),
      statementRepository: createStatementRepository(),
      insightProviderFactory: createClaudeInsightProvider,
      analytics,
    },
  });

  // serverless(Vercel 람다) freeze 전에 emit된 서버 이벤트 전송을 보장한다.
  await analytics.flush();

  return NextResponse.json(result.body, { status: result.status });
}

// composition root: 입력 형식별 파서를 골라 형식 무관한 ParsedStatement로
// 정규화한다. PDF 추출 어댑터(Claude)와 텍스트 추출(unpdf)은 여기서 주입한다.
async function toStatement(upload: Upload): Promise<ParsedStatement> {
  if (upload.kind === "pdf") {
    return extractPdfStatement(upload.data, {
      extractText: extractPdfText,
      extractor: createClaudePdfExtractor(),
    });
  }

  return parseCsvStatement(upload.data);
}

async function readUpload(request: NextRequest): Promise<Upload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const uploaded = formData.get("file") ?? formData.get("csv");

    if (uploaded instanceof Blob) {
      const data = Buffer.from(await uploaded.arrayBuffer());
      const name = uploaded instanceof File ? uploaded.name : "";

      return isPdfUpload(data, uploaded.type, name)
        ? { kind: "pdf", data }
        : { kind: "csv", data };
    }

    return { kind: "csv", data: typeof uploaded === "string" ? uploaded : "" };
  }

  return { kind: "csv", data: await request.text() };
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
