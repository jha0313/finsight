import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const callbackMocks = vi.hoisted(() => {
  const exchangeAuthCodeForSession = vi.fn();
  const resolveAuthCallbackRedirect = vi.fn();
  const getCurrentUser = vi.fn().mockResolvedValue(null);

  return {
    exchangeAuthCodeForSession,
    resolveAuthCallbackRedirect,
    getCurrentUser,
  };
});

vi.mock("@/services/supabase", () => ({
  exchangeAuthCodeForSession: callbackMocks.exchangeAuthCodeForSession,
  resolveAuthCallbackRedirect: callbackMocks.resolveAuthCallbackRedirect,
  getCurrentUser: callbackMocks.getCurrentUser,
}));

vi.mock("@/services/posthog/analytics", () => ({
  getPostHogClient: () => ({ capture: vi.fn(), identify: vi.fn() }),
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the resolved post-login destination", async () => {
    callbackMocks.resolveAuthCallbackRedirect.mockResolvedValue(
      new URL("https://finsight.test/dashboard"),
    );

    const request = new NextRequest(
      "https://finsight.test/auth/callback?code=oauth-code&next=%2Fdashboard",
    );

    const response = await GET(request);

    expect(callbackMocks.resolveAuthCallbackRedirect).toHaveBeenCalledWith({
      exchangeCodeForSession: callbackMocks.exchangeAuthCodeForSession,
      requestUrl:
        "https://finsight.test/auth/callback?code=oauth-code&next=%2Fdashboard",
    });
    expect(response.headers.get("location")).toBe(
      "https://finsight.test/dashboard",
    );
  });
});
