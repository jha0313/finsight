import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPolarWebhookRepository,
  createServiceRoleSupabaseClient,
} from "./service-role";

const serviceRoleMocks = vi.hoisted(() => {
  const createClient = vi.fn();
  const from = vi.fn();
  const insert = vi.fn();
  const upsert = vi.fn();
  const rpc = vi.fn();

  const client = {
    from,
    rpc,
  };

  return {
    client,
    createClient,
    from,
    insert,
    upsert,
    rpc,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: serviceRoleMocks.createClient,
}));

function table() {
  return {
    insert: serviceRoleMocks.insert,
    upsert: serviceRoleMocks.upsert,
  };
}

function setServiceRoleEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
}

describe("Supabase service_role webhook adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setServiceRoleEnv();
    serviceRoleMocks.createClient.mockReturnValue(serviceRoleMocks.client);
    serviceRoleMocks.from.mockReturnValue(table());
    serviceRoleMocks.insert.mockResolvedValue({ error: null });
    serviceRoleMocks.upsert.mockResolvedValue({ error: null });
    serviceRoleMocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("does not create a service_role client at import time", async () => {
    vi.resetModules();
    serviceRoleMocks.createClient.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await import("./service-role");

    expect(serviceRoleMocks.createClient).not.toHaveBeenCalled();
  });

  it("creates the service_role client lazily with server auth disabled", () => {
    const client = createServiceRoleSupabaseClient();

    expect(client).toBe(serviceRoleMocks.client);
    expect(serviceRoleMocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  });

  it("pre-inserts processed webhook event ids and reports unique conflicts", async () => {
    const repository = createPolarWebhookRepository();

    await expect(repository.markEventProcessed("evt_1")).resolves.toBe(
      "inserted",
    );

    expect(serviceRoleMocks.from).toHaveBeenCalledWith(
      "processed_webhook_events",
    );
    expect(serviceRoleMocks.insert).toHaveBeenCalledWith({
      event_id: "evt_1",
    });

    serviceRoleMocks.insert.mockResolvedValueOnce({
      error: { code: "23505", message: "duplicate key" },
    });

    await expect(repository.markEventProcessed("evt_1")).resolves.toBe(
      "already_processed",
    );
  });

  it("upserts subscription state through the conditional upsert_subscription RPC", async () => {
    const repository = createPolarWebhookRepository();

    await expect(
      repository.upsertSubscription({
        userId: "user-1",
        polarSubscriptionId: "sub_1",
        status: "active",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        cancelAtPeriodEnd: true,
        eventTimestamp: "2026-06-15T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();

    expect(serviceRoleMocks.rpc).toHaveBeenCalledWith("upsert_subscription", {
      p_user_id: "user-1",
      p_polar_subscription_id: "sub_1",
      p_status: "active",
      p_current_period_end: "2026-07-01T00:00:00.000Z",
      p_event_ts: "2026-06-15T00:00:00.000Z",
      p_cancel_at_period_end: true,
    });
  });
});
