import { NextResponse, type NextRequest } from "next/server";

import { runSubscriptionCancelRequest } from "@/lib/orchestration";
import { cancelSubscriptionAtPeriodEnd } from "@/services/polar";
import { getCurrentUser, getSubscriptionSummary } from "@/services/supabase";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // action=resume이면 예약 철회, 그 외(기본)는 기간 말 취소.
  const form = await request.formData();
  const cancel = form.get("action") !== "resume";

  const result = await runSubscriptionCancelRequest({
    cancel,
    redirectUrl: settingsRedirectUrl(request, cancel),
    deps: {
      getCurrentUser,
      getSubscription: getSubscriptionSummary,
      cancelSubscription: cancelSubscriptionAtPeriodEnd,
    },
  });

  if (result.status === 303) {
    return NextResponse.redirect(result.redirectUrl, result.status);
  }

  return NextResponse.json(result.body, { status: result.status });
}

// 처리 후 설정 페이지로 되돌리고, sub 쿼리로 결과 배너를 표시한다. DB 반영은
// Polar 웹훅이 담당하므로 sub는 "접수됨" 안내용 신호다.
function settingsRedirectUrl(request: NextRequest, cancel: boolean): string {
  return new URL(
    `/dashboard/settings?sub=${cancel ? "canceled" : "resumed"}`,
    request.url,
  ).toString();
}
