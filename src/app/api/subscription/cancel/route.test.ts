import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

import { POST } from "./route";

const cancelRouteMocks = vi.hoisted(() => ({
  runSubscriptionCancelRequest: vi.fn(),
  cancelSubscriptionAtPeriodEnd: vi.fn(),
  getCurrentUser: vi.fn(),
  getSubscriptionSummary: vi.fn(),
}));

vi.mock("@/lib/orchestration", () => ({
  runSubscriptionCancelRequest: cancelRouteMocks.runSubscriptionCancelRequest,
}));

vi.mock("@/services/polar", () => ({
  cancelSubscriptionAtPeriodEnd: cancelRouteMocks.cancelSubscriptionAtPeriodEnd,
}));

vi.mock("@/services/supabase", () => ({
  getCurrentUser: cancelRouteMocks.getCurrentUser,
  getSubscriptionSummary: cancelRouteMocks.getSubscriptionSummary,
}));

function makeRequest(action?: string): NextRequest {
  const form = new FormData();

  if (action !== undefined) {
    form.set("action", action);
  }

  return {
    url: "https://app.example/api/subscription/cancel",
    async formData() {
      return form;
    },
  } as unknown as NextRequest;
}

describe("subscription cancel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelRouteMocks.runSubscriptionCancelRequest.mockResolvedValue({
      status: 303,
      redirectUrl: "https://app.example/dashboard/settings?sub=canceled",
    });
  });

  it("schedules cancellation and redirects to settings with the real adapters", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://app.example/dashboard/settings?sub=canceled",
    );

    const arg = cancelRouteMocks.runSubscriptionCancelRequest.mock.calls[0][0];
    expect(arg.cancel).toBe(true);
    expect(arg.redirectUrl).toBe(
      "https://app.example/dashboard/settings?sub=canceled",
    );
    expect(arg.deps).toEqual({
      getCurrentUser: cancelRouteMocks.getCurrentUser,
      getSubscription: cancelRouteMocks.getSubscriptionSummary,
      cancelSubscription: cancelRouteMocks.cancelSubscriptionAtPeriodEnd,
    });
  });

  it("passes cancel=false and a resumed redirect for the resume action", async () => {
    await POST(makeRequest("resume"));

    const arg = cancelRouteMocks.runSubscriptionCancelRequest.mock.calls[0][0];
    expect(arg.cancel).toBe(false);
    expect(arg.redirectUrl).toBe(
      "https://app.example/dashboard/settings?sub=resumed",
    );
  });

  it("returns JSON for non-redirect results", async () => {
    cancelRouteMocks.runSubscriptionCancelRequest.mockResolvedValue({
      status: 409,
      body: { error: "no_active_subscription" },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "no_active_subscription",
    });
  });
});
