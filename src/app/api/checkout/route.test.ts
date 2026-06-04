import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    checkoutRouteMocks.createPolarCheckout.mockReturnValue({
      kind: "polar-checkout",
    });
    checkoutRouteMocks.runCheckoutRequest.mockResolvedValue({
      status: 303,
      redirectUrl: "https://polar.sh/checkout/session-1",
    });
  });

  it("redirects to the checkout url with lazy route adapters", async () => {
    const request = new NextRequest("https://finsight.test/api/checkout", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://polar.sh/checkout/session-1",
    );
    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledTimes(1);
    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledWith({
      productId: process.env.POLAR_PRODUCT_ID,
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
    const request = new NextRequest("https://finsight.test/api/checkout", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("does not read client-provided customer identifiers", async () => {
    const request = new NextRequest(
      "https://finsight.test/api/checkout?customerExternalId=attacker",
      {
        method: "POST",
        body: JSON.stringify({ customerExternalId: "attacker" }),
        headers: { "content-type": "application/json" },
      },
    );

    await POST(request);

    expect(checkoutRouteMocks.runCheckoutRequest).toHaveBeenCalledWith({
      productId: process.env.POLAR_PRODUCT_ID,
      deps: {
        getCurrentUser: checkoutRouteMocks.getCurrentUser,
        checkout: { kind: "polar-checkout" },
      },
    });
  });
});
