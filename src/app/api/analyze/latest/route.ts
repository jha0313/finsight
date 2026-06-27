import { NextResponse } from "next/server";

import { runLatestAnalysisRequest } from "@/lib/orchestration";
import { createClaudeInsightProvider } from "@/services/claude";
import { createPostHogAnalytics } from "@/services/posthog/analytics";
import {
  createAiUsage,
  createStatementRepository,
  createSubscriptionGateway,
  getCurrentUser,
  runWithSubscriptionRequestCache,
} from "@/services/supabase";

// 저장된 마지막 명세서를 Pro(Opus)로 재분석한다(인사이트 호출 1회 + 저장 RPC).
export const maxDuration = 120;

// 결제 복귀 후 자동 재분석. Opus 호출·quota 소비·캐시 저장 등 부수효과가 있어
// 링크 prefetch로 의도치 않게 트리거되지 않도록 POST로 받는다. 분석할 입력은
// 클라이언트 본문이 아니라 서버 세션 사용자의 저장된 명세서에서 가져온다.
export async function POST(): Promise<NextResponse> {
  const analytics = createPostHogAnalytics();
  const result = await runWithSubscriptionRequestCache(() =>
    runLatestAnalysisRequest({
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

  // serverless(Vercel 람다) freeze 전에 emit된 서버 이벤트 전송을 보장한다.
  await analytics.flush();

  return NextResponse.json(result.body, { status: result.status });
}
