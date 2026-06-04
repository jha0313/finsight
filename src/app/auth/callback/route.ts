import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeAuthCodeForSession,
  resolveAuthCallbackRedirect,
} from "@/services/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const redirectUrl = await resolveAuthCallbackRedirect({
    exchangeCodeForSession: exchangeAuthCodeForSession,
    requestUrl: request.url,
  });

  return NextResponse.redirect(redirectUrl);
}
