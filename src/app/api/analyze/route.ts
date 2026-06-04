import { NextResponse, type NextRequest } from "next/server";

import { runAnalyzeRequest } from "@/lib/orchestration";
import { createClaudeInsightProvider } from "@/services/claude";
import {
  createAiUsage,
  createStatementRepository,
  createSubscriptionGateway,
  getCurrentUser,
} from "@/services/supabase";

export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csv = await readCsvUpload(request);
  const result = await runAnalyzeRequest({
    csv,
    deps: {
      getCurrentUser,
      subscriptionGateway: createSubscriptionGateway(),
      aiUsage: createAiUsage(),
      statementRepository: createStatementRepository(),
      insightProviderFactory: createClaudeInsightProvider,
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}

async function readCsvUpload(request: NextRequest): Promise<string | Buffer> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const uploadedCsv = formData.get("file") ?? formData.get("csv");

    if (uploadedCsv instanceof Blob) {
      return Buffer.from(await uploadedCsv.arrayBuffer());
    }

    return typeof uploadedCsv === "string" ? uploadedCsv : "";
  }

  return request.text();
}
