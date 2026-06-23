import { NextResponse, type NextRequest } from "next/server";

import { runPostHogWebhookRequest } from "@/lib/orchestration";
import {
  createGitHubDispatch,
  verifyPostHogWebhook,
} from "@/services/posthog/webhook";
import { createOncallWebhookRepository } from "@/services/supabase/service-role";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const result = await runPostHogWebhookRequest({
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    deps: {
      verifyWebhook: verifyPostHogWebhook,
      eventRepository: createOncallWebhookRepository(),
      dispatch: createGitHubDispatch(),
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
