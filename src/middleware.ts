import { NextResponse, type NextRequest } from "next/server";

import {
  createMiddlewareSupabaseClient,
  isSupabaseConfigured,
  resolveMiddlewareAuthDecision,
} from "@/services/supabase";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Supabase 미설정(키 없음)에서는 세션을 갱신할 수 없으므로 미인증으로 처리한다.
  // 공개 경로는 그대로 렌더되고 보호 경로만 로그인으로 보낸다(런타임 throw 방지).
  let isAuthenticated = false;
  let response = NextResponse.next({ request });

  if (isSupabaseConfigured()) {
    const { supabase, getResponse } = createMiddlewareSupabaseClient(
      request,
      () => NextResponse.next({ request }),
    );
    const { data, error } = await supabase.auth.getUser();
    isAuthenticated = error === null && data.user !== null;
    response = getResponse();
  }

  const decision = resolveMiddlewareAuthDecision({
    isAuthenticated,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  if (decision.type === "next") {
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = decision.pathname;
  redirectUrl.search = decision.search;

  const redirectResponse = NextResponse.redirect(redirectUrl);
  copyResponseCookies(response, redirectResponse);

  return redirectResponse;
}

function copyResponseCookies(source: NextResponse, target: NextResponse): void {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
