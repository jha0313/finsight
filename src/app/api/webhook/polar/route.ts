import { NextResponse, type NextRequest } from "next/server";

import { runPolarWebhookRequest } from "@/lib/orchestration";
import { toSubscriptionUpsert, verifyPolarWebhook } from "@/services/polar";
import { createPolarWebhookRepository } from "@/services/supabase/service-role";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const result = await runPolarWebhookRequest({
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    deps: {
      verifyWebhook: verifyPolarWebhook,
      toSubscriptionUpsert,
      subscriptionRepository: createPolarWebhookRepository(),
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
