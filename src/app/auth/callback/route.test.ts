import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const callbackMocks = vi.hoisted(() => {
  const exchangeAuthCodeForSession = vi.fn();
  const resolveAuthCallbackRedirect = vi.fn();

  return {
    exchangeAuthCodeForSession,
    resolveAuthCallbackRedirect,
  };
});

vi.mock("@/services/supabase", () => ({
  exchangeAuthCodeForSession: callbackMocks.exchangeAuthCodeForSession,
  resolveAuthCallbackRedirect: callbackMocks.resolveAuthCallbackRedirect,
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
