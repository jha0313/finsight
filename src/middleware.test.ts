import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { middleware } from "./middleware";

const authMocks = vi.hoisted(() => {
  const authGetSession = vi.fn();
  const authGetUser = vi.fn();
  const createMiddlewareSupabaseClient = vi.fn();
  const getResponse = vi.fn();
  const isSupabaseConfigured = vi.fn();
  const resolveMiddlewareAuthDecision = vi.fn();

  return {
    authGetSession,
    authGetUser,
    createMiddlewareSupabaseClient,
    getResponse,
    isSupabaseConfigured,
    resolveMiddlewareAuthDecision,
  };
});

vi.mock("@/services/supabase", () => ({
  createMiddlewareSupabaseClient: authMocks.createMiddlewareSupabaseClient,
  isSupabaseConfigured: authMocks.isSupabaseConfigured,
  resolveMiddlewareAuthDecision: authMocks.resolveMiddlewareAuthDecision,
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.isSupabaseConfigured.mockReturnValue(true);
    authMocks.createMiddlewareSupabaseClient.mockReturnValue({
      getResponse: authMocks.getResponse,
      supabase: {
        auth: {
          getSession: authMocks.authGetSession,
          getUser: authMocks.authGetUser,
        },
      },
    });
    authMocks.getResponse.mockReturnValue(NextResponse.next());
  });

  it("redirects unauthenticated protected requests using getUser verification", async () => {
    authMocks.authGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    authMocks.resolveMiddlewareAuthDecision.mockReturnValue({
      type: "redirect",
      pathname: "/login",
      search: "?next=%2Fdashboard",
    });

    const response = await middleware(
      new NextRequest("https://finsight.test/dashboard"),
    );

    expect(authMocks.authGetUser).toHaveBeenCalledTimes(1);
    expect(authMocks.authGetSession).not.toHaveBeenCalled();
    expect(authMocks.resolveMiddlewareAuthDecision).toHaveBeenCalledWith({
      isAuthenticated: false,
      pathname: "/dashboard",
      search: "",
    });
    expect(response.headers.get("location")).toBe(
      "https://finsight.test/login?next=%2Fdashboard",
    );
  });

  it("lets authenticated protected requests continue", async () => {
    const nextResponse = NextResponse.next();
    authMocks.getResponse.mockReturnValue(nextResponse);
    authMocks.authGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    authMocks.resolveMiddlewareAuthDecision.mockReturnValue({ type: "next" });

    const response = await middleware(
      new NextRequest("https://finsight.test/dashboard"),
    );

    expect(authMocks.resolveMiddlewareAuthDecision).toHaveBeenCalledWith({
      isAuthenticated: true,
      pathname: "/dashboard",
      search: "",
    });
    expect(response).toBe(nextResponse);
  });

  it("treats requests as unauthenticated without a Supabase client when not configured", async () => {
    authMocks.isSupabaseConfigured.mockReturnValue(false);
    authMocks.resolveMiddlewareAuthDecision.mockReturnValue({ type: "next" });

    const response = await middleware(new NextRequest("https://finsight.test/"));

    expect(authMocks.createMiddlewareSupabaseClient).not.toHaveBeenCalled();
    expect(authMocks.authGetUser).not.toHaveBeenCalled();
    expect(authMocks.resolveMiddlewareAuthDecision).toHaveBeenCalledWith({
      isAuthenticated: false,
      pathname: "/",
      search: "",
    });
    expect(response).toBeInstanceOf(NextResponse);
  });
});
