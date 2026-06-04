import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  SubscriptionUpsertPayload,
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
      const { error } = await getSupabase()
        .from("subscriptions")
        .upsert(toSubscriptionRow(input), { onConflict: "user_id" });

      throwIfSupabaseError(error, "subscriptions upsert failed");
    },
  };
}

function toSubscriptionRow(input: SubscriptionUpsertPayload): {
  user_id: string;
  polar_subscription_id: string;
  status: string;
  current_period_end: string | null;
  updated_at: string;
} {
  return {
    user_id: input.userId,
    polar_subscription_id: input.polarSubscriptionId,
    status: input.status,
    current_period_end: input.currentPeriodEnd,
    updated_at: new Date().toISOString(),
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
