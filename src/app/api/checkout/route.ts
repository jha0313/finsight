import { NextResponse } from "next/server";

import { runCheckoutRequest } from "@/lib/orchestration";
import { createPolarCheckout } from "@/services/polar";
import { getCurrentUser } from "@/services/supabase";

export async function POST(): Promise<NextResponse> {
  const result = await runCheckoutRequest({
    productId: process.env.POLAR_PRODUCT_ID,
    successUrl: checkoutSuccessUrl(),
    deps: {
      getCurrentUser,
      checkout: createPolarCheckout(),
    },
  });

  if (result.status === 401) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.redirect(result.redirectUrl, result.status);
}

// 결제 완료 후 Polar가 사용자를 돌려보낼 앱 내부 URL. 미설정 시 Polar 기본
// thank-you 페이지에 머문다.
function checkoutSuccessUrl(): string | undefined {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return baseUrl ? `${baseUrl}/dashboard` : undefined;
}
