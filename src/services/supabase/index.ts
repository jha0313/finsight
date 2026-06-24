import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiUsageGateway,
  StatementRepository,
  SubscriptionGateway,
} from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

const DAILY_AI_QUOTA_BY_TIER: Record<Tier, number> = {
  free: 3,
  pro: 20,
};
const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";
const LOGIN_PATH = "/login";
const PROTECTED_PATH_PREFIXES = ["/dashboard"];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type SupabaseCookieMethods = {
  getAll: () =>
    | { name: string; value: string }[]
    | Promise<{ name: string; value: string }[]>;
  setAll: (cookiesToSet: CookieToSet[]) => void | Promise<void>;
};

type MiddlewareRequest = {
  cookies: {
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string) => void;
  };
};

type MiddlewareResponse = {
  cookies: {
    set: (name: string, value: string, options: CookieOptions) => void;
  };
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  polar_subscription_id: string | null;
};

type SaveStatementAnalysisRpcRow = {
  statement_id?: string;
  statementId?: string;
};

type AnalysisRow = {
  result: unknown;
};

type RpcTransaction = {
  date: string;
  merchant: string;
  signedAmount: string;
  direction: Transaction["direction"];
  category: Transaction["category"];
  maskedAccount?: string;
  currency: string;
  rowHash: string;
};

type LatestStatementRow = {
  id: string;
  source_hash: string;
};

type LatestTransactionRow = {
  txn_date: string;
  merchant: string;
  // numeric은 정밀도 보존을 위해 string으로 직렬화되지만 방어적으로 number도 받는다.
  signed_amount: string | number;
  direction: Transaction["direction"];
  category: Transaction["category"];
  masked_account: string | null;
  currency: string;
  row_hash: string;
};

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

export function createServerSupabaseClient(): SupabaseClient {
  return createSupabaseClientWithCookies({
    getAll: getAllRequestCookies,
    setAll: setAllResponseCookies,
  });
}

export function createMiddlewareSupabaseClient<Response extends MiddlewareResponse>(
  request: MiddlewareRequest,
  createResponse: () => Response,
): {
  supabase: SupabaseClient;
  getResponse: () => Response;
} {
  let response = createResponse();
  const supabase = createSupabaseClientWithCookies({
    getAll() {
      return request.cookies.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      }));
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }

      response = createResponse();

      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}

export async function createGoogleOAuthUrl(
  redirectTo: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error !== null) {
    return null;
  }

  return data.url ?? null;
}

export async function exchangeAuthCodeForSession(
  code: string,
): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  return error === null;
}

export type MiddlewareAuthDecision =
  | { type: "next" }
  | { type: "redirect"; pathname: string; search: string };

export function resolveMiddlewareAuthDecision(input: {
  isAuthenticated: boolean;
  pathname: string;
  search: string;
}): MiddlewareAuthDecision {
  if (input.isAuthenticated || !isProtectedPath(input.pathname)) {
    return { type: "next" };
  }

  const nextPath = sanitizeRedirectPath(`${input.pathname}${input.search}`);
  const searchParams = new URLSearchParams({ next: nextPath });

  return {
    type: "redirect",
    pathname: LOGIN_PATH,
    search: `?${searchParams.toString()}`,
  };
}

export async function resolveAuthCallbackRedirect(input: {
  exchangeCodeForSession: (code: string) => Promise<boolean>;
  requestUrl: string;
}): Promise<URL> {
  const requestUrl = new URL(input.requestUrl);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"));

  if (code === null || code === "") {
    return createLoginRedirectUrl(requestUrl.origin, "missing_code", nextPath);
  }

  const exchanged = await input.exchangeCodeForSession(code);

  if (!exchanged) {
    return createLoginRedirectUrl(requestUrl.origin, "oauth", nextPath);
  }

  return new URL(nextPath, requestUrl.origin);
}

export function sanitizeRedirectPath(path: string | null | undefined): string {
  if (path === null || path === undefined) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  const trimmed = path.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  try {
    const redirectUrl = new URL(trimmed, "https://finsight.local");

    if (redirectUrl.origin !== "https://finsight.local") {
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
}

function createSupabaseClientWithCookies(
  cookieMethods: SupabaseCookieMethods,
): SupabaseClient {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createServerClient(supabaseUrl, publishableKey, {
    cookies: cookieMethods,
  });
}

export async function getCurrentUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error !== null) {
    return null;
  }

  return data.user === null
    ? null
    : { id: data.user.id, email: data.user.email ?? null };
}

export interface SubscriptionSummary {
  tier: Tier;
  currentPeriodEnd: string | null;
  // 기간 말 취소 예약 여부(Pro일 때만 의미가 있다). true면 현재 기간 종료 후
  // Free로 전환될 예정이라는 안내·취소 철회 UI를 보여준다.
  cancelAtPeriodEnd: boolean;
  // 본인 구독을 취소/철회하기 위한 Polar 구독 ID. Pro가 아니면 null.
  polarSubscriptionId: string | null;
}

export const FREE_SUMMARY: SubscriptionSummary = {
  tier: "free",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  polarSubscriptionId: null,
};

export async function getSubscriptionSummary(
  userId: string,
): Promise<SubscriptionSummary> {
  const supabase = createServerSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,current_period_end,cancel_at_period_end,polar_subscription_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", now)
    .maybeSingle<SubscriptionRow>();

  if (
    error !== null ||
    data === null ||
    data.status !== "active" ||
    data.current_period_end === null ||
    data.current_period_end <= now
  ) {
    return FREE_SUMMARY;
  }

  return {
    tier: "pro",
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    polarSubscriptionId: data.polar_subscription_id,
  };
}

export async function signOutCurrentUser(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
}

export function createStatementRepository(): StatementRepository {
  return {
    async loadLatestStatement(userId) {
      const supabase = createServerSupabaseClient();

      const { data: statement, error: statementError } = await supabase
        .from("statements")
        .select("id,source_hash")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<LatestStatementRow>();

      throwIfSupabaseError(statementError, "latest statement lookup failed");

      if (statement === null) {
        return null;
      }

      const { data: rows, error: transactionsError } = await supabase
        .from("transactions")
        .select(
          "txn_date,merchant,signed_amount,direction,category,masked_account,currency,row_hash",
        )
        .eq("user_id", userId)
        .eq("statement_id", statement.id)
        // 분석 결과의 결정성을 위해 안정적인 순서로 읽는다(거래의 원래 행 순서는
        // 보관하지 않으므로 날짜→row_hash로 정렬).
        .order("txn_date", { ascending: true })
        .order("row_hash", { ascending: true })
        .returns<LatestTransactionRow[]>();

      throwIfSupabaseError(
        transactionsError,
        "latest transactions lookup failed",
      );

      const transactions = (rows ?? []).map(toTransactionFromRow);

      if (transactions.length === 0) {
        return null;
      }

      return { sourceHash: statement.source_hash, transactions };
    },

    async saveStatementAnalysis(input) {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.rpc("save_statement_analysis", {
        p_user_id: input.userId,
        p_statement_source_hash: input.statement.sourceHash,
        p_statement_status: input.statement.status,
        p_transactions: input.transactions.map(toRpcTransaction),
        p_analysis: input.analysis ?? null,
      });

      throwIfSupabaseError(error, "save_statement_analysis RPC failed");

      const row = firstRpcRow(data);
      const statementId = row?.statement_id ?? row?.statementId;

      if (statementId === undefined) {
        throw new Error("save_statement_analysis RPC returned no statement_id.");
      }

      return { statementId };
    },
  };
}

export function createSubscriptionGateway(): SubscriptionGateway {
  const requestCache = new Map<string, Promise<SubscriptionSummary>>();

  return {
    async resolveTier(userId) {
      let summary = requestCache.get(userId);

      if (summary === undefined) {
        summary = getSubscriptionSummary(userId);
        requestCache.set(userId, summary);
      }

      const { tier } = await summary;
      return tier;
    },
  };
}

export function createAiUsage(): AiUsageGateway {
  return {
    async getCachedInsights(userId, inputHash) {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("analyses")
        .select("result")
        .eq("user_id", userId)
        .eq("input_hash", inputHash)
        .maybeSingle<AnalysisRow>();

      throwIfSupabaseError(error, "analyses cache lookup failed");

      return data?.result ?? null;
    },

    async tryConsumeDailyQuota(userId, tier) {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.rpc("consume_ai_quota", {
        p_user_id: userId,
        p_usage_date: todayIsoDate(),
        p_quota: DAILY_AI_QUOTA_BY_TIER[tier],
      });

      throwIfSupabaseError(error, "consume_ai_quota RPC failed");

      return data === true;
    },

    async releaseDailyQuota(userId) {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.rpc("release_ai_quota", {
        p_user_id: userId,
        p_usage_date: todayIsoDate(),
      });

      throwIfSupabaseError(error, "release_ai_quota RPC failed");
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name} is required to create a Supabase server client.`);
  }

  return value;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function createLoginRedirectUrl(
  origin: string,
  error: string,
  nextPath: string,
): URL {
  const redirectUrl = new URL(LOGIN_PATH, origin);
  redirectUrl.searchParams.set("error", error);
  redirectUrl.searchParams.set("next", nextPath);

  return redirectUrl;
}

async function getAllRequestCookies(): Promise<{ name: string; value: string }[]> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    return cookieStore.getAll().map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
    }));
  } catch {
    return [];
  }
}

async function setAllResponseCookies(cookiesToSet: CookieToSet[]): Promise<void> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    for (const { name, value, options } of cookiesToSet) {
      cookieStore.set(name, value, options);
    }
  } catch {
    // Some server contexts cannot mutate cookies after response generation.
  }
}

function toRpcTransaction(transaction: Transaction): RpcTransaction {
  const payload: RpcTransaction = {
    date: transaction.date,
    merchant: transaction.merchant,
    signedAmount: transaction.signedAmount,
    direction: transaction.direction,
    category: transaction.category,
    currency: transaction.currency,
    rowHash: transaction.rowHash,
  };

  if (transaction.maskedAccount !== undefined) {
    payload.maskedAccount = transaction.maskedAccount;
  }

  return payload;
}

function toTransactionFromRow(row: LatestTransactionRow): Transaction {
  const transaction: Transaction = {
    date: row.txn_date,
    merchant: row.merchant,
    signedAmount: String(row.signed_amount),
    direction: row.direction,
    category: row.category,
    currency: row.currency,
    rowHash: row.row_hash,
  };

  if (row.masked_account !== null && row.masked_account !== "") {
    transaction.maskedAccount = row.masked_account;
  }

  return transaction;
}

function firstRpcRow(data: unknown): SaveStatementAnalysisRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as SaveStatementAnalysisRpcRow | undefined) ?? null;
  }

  return data === null ? null : (data as SaveStatementAnalysisRpcRow);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function throwIfSupabaseError(
  error: SupabaseError | null,
  context: string,
): void {
  if (error !== null) {
    throw new Error(`${context}: ${error.message ?? "unknown Supabase error"}`);
  }
}
