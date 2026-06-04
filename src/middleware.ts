import { NextResponse, type NextRequest } from "next/server";

import {
  createMiddlewareSupabaseClient,
  resolveMiddlewareAuthDecision,
} from "@/services/supabase";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request, () =>
    NextResponse.next({ request }),
  );
  const { data, error } = await supabase.auth.getUser();
  const decision = resolveMiddlewareAuthDecision({
    isAuthenticated: error === null && data.user !== null,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });
  const response = getResponse();

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
