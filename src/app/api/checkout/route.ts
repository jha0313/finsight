import { NextResponse } from "next/server";

import { runCheckoutRequest } from "@/lib/orchestration";
import { createPolarCheckout } from "@/services/polar";
import { getCurrentUser } from "@/services/supabase";

export async function POST(): Promise<NextResponse> {
  const result = await runCheckoutRequest({
    productId: process.env.POLAR_PRODUCT_ID,
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
