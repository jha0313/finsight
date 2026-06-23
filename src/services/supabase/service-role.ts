import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  OncallEventRepository,
  WebhookSubscriptionRepository,
} from "@/types/ports";

type SupabaseError = {
  code?: string;
  message?: string;
};

export function createServiceRoleSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function createPolarWebhookRepository(): WebhookSubscriptionRepository {
  let supabase: SupabaseClient | null = null;
  const getSupabase = () => {
    supabase ??= createServiceRoleSupabaseClient();

    return supabase;
  };

  return {
    async markEventProcessed(eventId) {
      const { error } = await getSupabase()
        .from("processed_webhook_events")
        .insert({ event_id: eventId });

      if (isUniqueViolation(error)) {
        return "already_processed";
      }

      throwIfSupabaseError(error, "processed_webhook_events insert failed");

      return "inserted";
    },

    async upsertSubscription(input) {
      // 조건부 upsert RPC가 event_ts 기준으로 stale 이벤트를 무시한다.
      // (순서 보장이 없는 웹훅에서 취소→활성 역전으로 인한 Pro 오부여 방지)
      const { error } = await getSupabase().rpc("upsert_subscription", {
        p_user_id: input.userId,
        p_polar_subscription_id: input.polarSubscriptionId,
        p_status: input.status,
        p_current_period_end: input.currentPeriodEnd,
        p_event_ts: input.eventTimestamp,
        p_cancel_at_period_end: input.cancelAtPeriodEnd,
      });

      throwIfSupabaseError(error, "upsert_subscription RPC failed");
    },
  };
}

// oncall prod alert 멱등(event_id 선삽입). Polar 웹훅과 같은
// processed_webhook_events 테이블을 공유하되, 키는 verifyPostHogWebhook이
// "posthog:" prefix로 네임스페이스를 분리한다. service_role로 RLS를 우회한다.
export function createOncallWebhookRepository(): OncallEventRepository {
  let supabase: SupabaseClient | null = null;
  const getSupabase = () => {
    supabase ??= createServiceRoleSupabaseClient();

    return supabase;
  };

  return {
    async markEventProcessed(eventId) {
      const { error } = await getSupabase()
        .from("processed_webhook_events")
        .insert({ event_id: eventId });

      if (isUniqueViolation(error)) {
        return "already_processed";
      }

      throwIfSupabaseError(error, "processed_webhook_events insert failed");

      return "inserted";
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name} is required to create a Supabase service client.`);
  }

  return value;
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
