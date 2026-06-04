import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  StatementRepository,
  SubscriptionGateway,
} from "@/types/ports";
import type { Tier } from "@/types/tier";
import type { Transaction } from "@/types/transaction";

const DAILY_AI_QUOTA_BY_TIER: Record<Tier, number> = {
  free: 3,
  pro: 20,
};
const MAX_QUOTA_CONSUME_ATTEMPTS = 3;

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
};

type UsageRow = {
  count: number;
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

export function createServerSupabaseClient(): SupabaseClient {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: getAllRequestCookies,
      setAll: setAllResponseCookies,
    },
  });
}

export async function getCurrentUser(): Promise<{ id: string } | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error !== null) {
    return null;
  }

  return data.user === null ? null : { id: data.user.id };
}

export function createStatementRepository(): StatementRepository {
  return {
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
  return {
    async resolveTier(userId) {
      const supabase = createServerSupabaseClient();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", now)
        .maybeSingle<SubscriptionRow>();

      if (error !== null || data === null) {
        return "free";
      }

      return data.status === "active" &&
        data.current_period_end !== null &&
        data.current_period_end > now
        ? "pro"
        : "free";
    },
  };
}

export function createAiUsage(): {
  getCachedInsights(userId: string, inputHash: string): Promise<unknown | null>;
  tryConsumeDailyQuota(userId: string, tier: Tier): Promise<boolean>;
} {
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
      const usageDate = todayIsoDate();
      const quota = DAILY_AI_QUOTA_BY_TIER[tier];

      for (let attempt = 0; attempt < MAX_QUOTA_CONSUME_ATTEMPTS; attempt += 1) {
        const currentCount = await getDailyUsageCount(
          supabase,
          userId,
          usageDate,
        );

        if (currentCount === null) {
          const inserted = await insertFirstDailyUsage(
            supabase,
            userId,
            usageDate,
          );

          if (inserted) {
            return true;
          }

          continue;
        }

        if (currentCount >= quota) {
          return false;
        }

        const consumed = await incrementDailyUsageCount(
          supabase,
          userId,
          usageDate,
          currentCount,
        );

        if (consumed) {
          return true;
        }
      }

      return false;
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

function firstRpcRow(data: unknown): SaveStatementAnalysisRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as SaveStatementAnalysisRpcRow | undefined) ?? null;
  }

  return data === null ? null : (data as SaveStatementAnalysisRpcRow);
}

async function getDailyUsageCount(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("ai_usage_daily")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle<UsageRow>();

  throwIfSupabaseError(error, "ai_usage_daily lookup failed");

  return data?.count ?? null;
}

async function insertFirstDailyUsage(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_usage_daily")
    .insert({
      user_id: userId,
      usage_date: usageDate,
      count: 1,
    })
    .select("count")
    .single<UsageRow>();

  if (isUniqueViolation(error)) {
    return false;
  }

  throwIfSupabaseError(error, "ai_usage_daily insert failed");

  return data?.count === 1;
}

async function incrementDailyUsageCount(
  supabase: SupabaseClient,
  userId: string,
  usageDate: string,
  currentCount: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_usage_daily")
    .update({ count: currentCount + 1 })
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .eq("count", currentCount)
    .select("count")
    .maybeSingle<UsageRow>();

  throwIfSupabaseError(error, "ai_usage_daily increment failed");

  return data?.count === currentCount + 1;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isUniqueViolation(error: SupabaseError | null): boolean {
  return error?.code === "23505";
}

function throwIfSupabaseError(
  error: SupabaseError | null,
  context: string,
): void {
  if (error !== null) {
    throw new Error(`${context}: ${error.message ?? "unknown Supabase error"}`);
  }
}
