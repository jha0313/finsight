import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const checkoutRouteMocks = vi.hoisted(() => {
  const createPolarCheckout = vi.fn();
  const getCurrentUser = vi.fn();
  const runCheckoutRequest = vi.fn();

  return {
    createPolarCheckout,
    getCurrentUser,
    runCheckoutRequest,
  };
});

vi.mock("@/lib/orchestration", () => ({
  runCheckoutRequest: checkoutRouteMocks.runCheckoutRequest,
}));

vi.mock("@/services/polar", () => ({
  createPolarCheckout: checkoutRouteMocks.createPolarCheckout,
}));

vi.mock("@/services/supabase", () => ({
  getCurrentUser: checkoutRouteMocks.getCurrentUser,
}));

describe("checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    checkoutRouteMocks.createPolarCheckout.mockReturnValue({
      kind: "polar-checkout",
    });
    checkoutRouteMocks.runCheckoutRequest.mockResolvedValue({
      status: 303,
      redirectUrl: "https://polar.sh/checkout/session-1",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects to the checkout url with lazy route adapters", async () => {
    const response = await POST();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://polar.sh/checkout/session-1",
    );
    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledTimes(1);
    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledWith({
      productId: process.env.POLAR_PRODUCT_ID,
      successUrl: "https://app.example/dashboard",
      deps: {
        getCurrentUser: checkoutRouteMocks.getCurrentUser,
        checkout: { kind: "polar-checkout" },
      },
    });
  });

  it("returns 401 JSON for unauthenticated users", async () => {
    checkoutRouteMocks.runCheckoutRequest.mockResolvedValue({
      status: 401,
      body: { error: "unauthorized" },
    });

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("takes no request argument, so client-provided identifiers cannot reach the handler", async () => {
    // POST의 시그니처가 인자 0개이므로 쿼리·본문의 customerExternalId가
    // 구조적으로 핸들러에 도달할 수 없다. (customerExternalId 강제는
    // orchestration 레벨에서 getCurrentUser().id로 검증한다)
    expect(POST.length).toBe(0);

    await POST();

    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledWith({
      productId: process.env.POLAR_PRODUCT_ID,
      successUrl: "https://app.example/dashboard",
      deps: {
        getCurrentUser: checkoutRouteMocks.getCurrentUser,
        checkout: { kind: "polar-checkout" },
      },
    });
  });

  it("omits successUrl when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    await POST();

    const callArg =
      checkoutRouteMocks.runCheckoutRequest.mock.calls[0][0];
    expect(callArg.successUrl).toBeUndefined();
  });
});
