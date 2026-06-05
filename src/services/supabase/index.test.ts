import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveStatementAnalysisInput } from "@/types/ports";

import {
  createAiUsage,
  createGoogleOAuthUrl,
  createMiddlewareSupabaseClient,
  createServerSupabaseClient,
  createStatementRepository,
  createSubscriptionGateway,
  exchangeAuthCodeForSession,
  getCurrentUser,
  isSupabaseConfigured,
  resolveAuthCallbackRedirect,
  resolveMiddlewareAuthDecision,
  sanitizeRedirectPath,
} from "./index";

const supabaseMocks = vi.hoisted(() => {
  const createServerClient = vi.fn();
  const authExchangeCodeForSession = vi.fn();
  const authGetSession = vi.fn();
  const authGetUser = vi.fn();
  const authSignInWithOAuth = vi.fn();
  const eq = vi.fn();
  const gt = vi.fn();
  const insert = vi.fn();
  const maybeSingle = vi.fn();
  const rpc = vi.fn();
  const select = vi.fn();
  const single = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn();

  const client = {
    auth: {
      exchangeCodeForSession: authExchangeCodeForSession,
      getSession: authGetSession,
      getUser: authGetUser,
      signInWithOAuth: authSignInWithOAuth,
    },
    from,
    rpc,
  };

  return {
    authExchangeCodeForSession,
    authGetSession,
    authGetUser,
    authSignInWithOAuth,
    client,
    createServerClient,
    eq,
    gt,
    insert,
    maybeSingle,
    rpc,
    select,
    single,
    update,
    upsert,
    from,
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: supabaseMocks.createServerClient,
}));

function selectChain(finalResult: unknown = { data: null, error: null }) {
  const chain = {
    eq: supabaseMocks.eq,
    gt: supabaseMocks.gt,
    maybeSingle: supabaseMocks.maybeSingle,
    single: supabaseMocks.single,
  };

  supabaseMocks.select.mockReturnValue(chain);
  supabaseMocks.eq.mockReturnValue(chain);
  supabaseMocks.gt.mockReturnValue(chain);
  supabaseMocks.maybeSingle.mockResolvedValue(finalResult);
  supabaseMocks.single.mockResolvedValue(finalResult);

  return chain;
}

function table() {
  return {
    insert: supabaseMocks.insert,
    select: supabaseMocks.select,
    update: supabaseMocks.update,
    upsert: supabaseMocks.upsert,
  };
}

function setSupabaseEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
}

describe("supabase adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseEnv();
    supabaseMocks.createServerClient.mockReturnValue(supabaseMocks.client);
    supabaseMocks.from.mockReturnValue(table());
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ statement_id: "statement-1" }],
      error: null,
    });
    supabaseMocks.authGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.authGetSession.mockResolvedValue({
      data: { session: { user: { id: "session-user" } } },
      error: null,
    });
    supabaseMocks.authExchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    supabaseMocks.authSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/oauth" },
      error: null,
    });
  });

  it("does not create a Supabase client at import time", async () => {
    vi.resetModules();
    supabaseMocks.createServerClient.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    await import("./index");

    expect(supabaseMocks.createServerClient).not.toHaveBeenCalled();
  });

  it("creates the server client lazily with publishable env", () => {
    const client = createServerSupabaseClient();

    expect(client).toBe(supabaseMocks.client);
    expect(supabaseMocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  it("verifies auth with getUser instead of trusting getSession", async () => {
    const user = await getCurrentUser();

    expect(user).toEqual({ id: "user-1" });
    expect(supabaseMocks.authGetUser).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.authGetSession).not.toHaveBeenCalled();
  });

  it("reports configuration from the publishable env presence", () => {
    expect(isSupabaseConfigured()).toBe(true);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns null user without throwing when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    supabaseMocks.createServerClient.mockClear();

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(supabaseMocks.createServerClient).not.toHaveBeenCalled();
    expect(supabaseMocks.authGetUser).not.toHaveBeenCalled();
  });

  it("returns a null OAuth url without throwing when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    supabaseMocks.createServerClient.mockClear();

    await expect(
      createGoogleOAuthUrl(
        "https://finsight.test/auth/callback?next=%2Fdashboard",
      ),
    ).resolves.toBeNull();
    expect(supabaseMocks.createServerClient).not.toHaveBeenCalled();
    expect(supabaseMocks.authSignInWithOAuth).not.toHaveBeenCalled();
  });

  it("starts Google OAuth through Supabase with the provided callback URL", async () => {
    await expect(
      createGoogleOAuthUrl(
        "https://finsight.test/auth/callback?next=%2Fdashboard",
      ),
    ).resolves.toBe("https://accounts.google.com/oauth");

    expect(supabaseMocks.authSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://finsight.test/auth/callback?next=%2Fdashboard",
      },
    });
  });

  it("exchanges OAuth codes through the lazy Supabase server client", async () => {
    await expect(exchangeAuthCodeForSession("oauth-code")).resolves.toBe(true);

    expect(supabaseMocks.authExchangeCodeForSession).toHaveBeenCalledWith(
      "oauth-code",
    );
  });

  it("sanitizes post-auth redirect paths to internal paths only", () => {
    expect(sanitizeRedirectPath("/dashboard?tab=upload")).toBe(
      "/dashboard?tab=upload",
    );
    expect(sanitizeRedirectPath("https://evil.test/dashboard")).toBe(
      "/dashboard",
    );
    expect(sanitizeRedirectPath("//evil.test/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("dashboard")).toBe("/dashboard");
  });

  it("redirects unauthenticated protected paths to login with next preserved", () => {
    expect(
      resolveMiddlewareAuthDecision({
        isAuthenticated: false,
        pathname: "/dashboard",
        search: "?tab=upload",
      }),
    ).toEqual({
      type: "redirect",
      pathname: "/login",
      search: "?next=%2Fdashboard%3Ftab%3Dupload",
    });
  });

  it("lets authenticated protected paths and public paths continue", () => {
    expect(
      resolveMiddlewareAuthDecision({
        isAuthenticated: true,
        pathname: "/dashboard",
        search: "",
      }),
    ).toEqual({ type: "next" });
    expect(
      resolveMiddlewareAuthDecision({
        isAuthenticated: false,
        pathname: "/login",
        search: "",
      }),
    ).toEqual({ type: "next" });
  });

  it("uses middleware cookies without creating the client at import time", () => {
    const request = {
      cookies: {
        getAll: vi.fn().mockReturnValue([{ name: "sb", value: "request" }]),
        set: vi.fn(),
      },
    };
    const response = {
      cookies: {
        set: vi.fn(),
      },
    };
    const createResponse = vi.fn().mockReturnValue(response);

    createMiddlewareSupabaseClient(request, createResponse);

    const cookieMethods = supabaseMocks.createServerClient.mock.calls.at(-1)?.[2]
      .cookies;
    expect(cookieMethods.getAll()).toEqual([{ name: "sb", value: "request" }]);

    cookieMethods.setAll([
      {
        name: "sb",
        value: "response",
        options: { path: "/" },
      },
    ]);

    expect(request.cookies.set).toHaveBeenCalledWith("sb", "response");
    expect(response.cookies.set).toHaveBeenCalledWith("sb", "response", {
      path: "/",
    });
    expect(createResponse).toHaveBeenCalledTimes(2);
  });

  it("resolves OAuth callback redirects after exchanging the code", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue(true);

    const redirectUrl = await resolveAuthCallbackRedirect({
      exchangeCodeForSession,
      requestUrl:
        "https://finsight.test/auth/callback?code=oauth-code&next=%2Fdashboard%3Ftab%3Dupload",
    });

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(redirectUrl.toString()).toBe(
      "https://finsight.test/dashboard?tab=upload",
    );
  });

  it("sends failed OAuth callbacks back to login without open redirects", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue(false);

    const redirectUrl = await resolveAuthCallbackRedirect({
      exchangeCodeForSession,
      requestUrl:
        "https://finsight.test/auth/callback?code=oauth-code&next=https%3A%2F%2Fevil.test",
    });

    expect(redirectUrl.toString()).toBe(
      "https://finsight.test/login?error=oauth&next=%2Fdashboard",
    );
  });

  it("returns null when getUser has no verified user", async () => {
    supabaseMocks.authGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("resolves pro only for active subscriptions with a future period", async () => {
    selectChain({
      data: {
        status: "active",
        current_period_end: "2999-01-01T00:00:00.000Z",
      },
      error: null,
    });

    const tier = await createSubscriptionGateway().resolveTier("user-1");

    expect(tier).toBe("pro");
    expect(supabaseMocks.from).toHaveBeenCalledWith("subscriptions");
    expect(supabaseMocks.select).toHaveBeenCalledWith("status,current_period_end");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabaseMocks.gt).toHaveBeenCalledWith(
      "current_period_end",
      expect.any(String),
    );
  });

  it("resolves free for missing, expired, or inactive subscriptions", async () => {
    const gateway = createSubscriptionGateway();

    selectChain({ data: null, error: null });
    await expect(gateway.resolveTier("user-1")).resolves.toBe("free");

    selectChain({
      data: {
        status: "active",
        current_period_end: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    await expect(gateway.resolveTier("user-1")).resolves.toBe("free");

    selectChain({
      data: {
        status: "canceled",
        current_period_end: "2999-01-01T00:00:00.000Z",
      },
      error: null,
    });
    await expect(gateway.resolveTier("user-1")).resolves.toBe("free");
  });

  it("saves statement analysis through the save_statement_analysis RPC", async () => {
    const input: SaveStatementAnalysisInput = {
      userId: "user-1",
      statement: {
        sourceHash: "source-hash",
        status: "ready",
      },
      transactions: [
        {
          date: "2026-06-01",
          merchant: "스타벅스 강남점",
          signedAmount: "5500.00",
          direction: "debit",
          category: "food",
          currency: "KRW",
          maskedAccount: "**** **** **** 3456",
          rowHash: "row-hash",
        },
      ],
      analysis: {
        inputHash: "input-hash",
        model: "claude-sonnet-4-6",
        result: {
          summary: "요약",
          insights: ["반복 결제를 점검하세요."],
        },
      },
    };

    await expect(
      createStatementRepository().saveStatementAnalysis(input),
    ).resolves.toEqual({ statementId: "statement-1" });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("save_statement_analysis", {
      p_user_id: "user-1",
      p_statement_source_hash: "source-hash",
      p_statement_status: "ready",
      p_transactions: [
        {
          date: "2026-06-01",
          merchant: "스타벅스 강남점",
          signedAmount: "5500.00",
          direction: "debit",
          category: "food",
          maskedAccount: "**** **** **** 3456",
          currency: "KRW",
          rowHash: "row-hash",
        },
      ],
      p_analysis: {
        inputHash: "input-hash",
        model: "claude-sonnet-4-6",
        result: {
          summary: "요약",
          insights: ["반복 결제를 점검하세요."],
        },
      },
    });
    expect(supabaseMocks.from).not.toHaveBeenCalledWith("statements");
    expect(supabaseMocks.from).not.toHaveBeenCalledWith("transactions");
    expect(supabaseMocks.from).not.toHaveBeenCalledWith("analyses");
  });

  it("reads cached insights by unique user and input hash", async () => {
    selectChain({
      data: { result: { summary: "cached" } },
      error: null,
    });

    const cached = await createAiUsage().getCachedInsights("user-1", "input-1");

    expect(cached).toEqual({ summary: "cached" });
    expect(supabaseMocks.from).toHaveBeenCalledWith("analyses");
    expect(supabaseMocks.select).toHaveBeenCalledWith("result");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("input_hash", "input-1");
  });

  it("consumes daily quota through the atomic consume_ai_quota RPC", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(
      createAiUsage().tryConsumeDailyQuota("user-1", "free"),
    ).resolves.toBe(true);

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("consume_ai_quota", {
      p_user_id: "user-1",
      p_usage_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      p_quota: 3,
    });
  });

  it("passes the pro tier limit to the consume_ai_quota RPC", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    await createAiUsage().tryConsumeDailyQuota("user-1", "pro");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "consume_ai_quota",
      expect.objectContaining({ p_quota: 20 }),
    );
  });

  it("returns false when the consume_ai_quota RPC reports the limit is reached", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      createAiUsage().tryConsumeDailyQuota("user-1", "free"),
    ).resolves.toBe(false);
  });

  it("refunds quota through the release_ai_quota RPC", async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ data: null, error: null });

    await createAiUsage().releaseDailyQuota("user-1", "pro");

    expect(supabaseMocks.rpc).toHaveBeenCalledWith("release_ai_quota", {
      p_user_id: "user-1",
      p_usage_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
