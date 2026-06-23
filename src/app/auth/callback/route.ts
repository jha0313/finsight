import { NextResponse, type NextRequest } from "next/server";

import { getPostHogClient } from "@/services/posthog/analytics";
import {
  exchangeAuthCodeForSession,
  getCurrentUser,
  resolveAuthCallbackRedirect,
} from "@/services/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const redirectUrl = await resolveAuthCallbackRedirect({
    exchangeCodeForSession: exchangeAuthCodeForSession,
    requestUrl: request.url,
  });

  const user = await getCurrentUser();
  if (user) {
    const posthog = getPostHogClient();
    posthog.identify({
      distinctId: user.id,
      properties: { email: user.email },
    });
    posthog.capture({
      distinctId: user.id,
      event: "user_signed_in",
      properties: { provider: "google" },
    });
  }

  return NextResponse.redirect(redirectUrl);
}
