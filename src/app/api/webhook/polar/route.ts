import { NextResponse, type NextRequest } from "next/server";

import { runPolarWebhookRequest } from "@/lib/orchestration";
import { toSubscriptionUpsert, verifyPolarWebhook } from "@/services/polar";
import { createPostHogAnalytics } from "@/services/posthog/analytics";
import { createPolarWebhookRepository } from "@/services/supabase/service-role";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const analytics = createPostHogAnalytics();
  const result = await runPolarWebhookRequest({
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    deps: {
      verifyWebhook: verifyPolarWebhook,
      toSubscriptionUpsert,
      subscriptionRepository: createPolarWebhookRepository(),
      analytics,
    },
  });

  // serverless(Vercel 람다) freeze 전에 subscription_activated 전송을 보장한다.
  await analytics.flush();

  return NextResponse.json(result.body, { status: result.status });
}
