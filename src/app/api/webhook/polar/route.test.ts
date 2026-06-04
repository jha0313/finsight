import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const webhookRouteMocks = vi.hoisted(() => {
  const createPolarWebhookRepository = vi.fn();
  const markEventProcessed = vi.fn();
  const toSubscriptionUpsert = vi.fn();
  const upsertSubscription = vi.fn();
  const verifyPolarWebhook = vi.fn();

  return {
    createPolarWebhookRepository,
    markEventProcessed,
    toSubscriptionUpsert,
    upsertSubscription,
    verifyPolarWebhook,
  };
});

vi.mock("@/services/polar", () => ({
  toSubscriptionUpsert: webhookRouteMocks.toSubscriptionUpsert,
  verifyPolarWebhook: webhookRouteMocks.verifyPolarWebhook,
}));

vi.mock("@/services/supabase/service-role", () => ({
  createPolarWebhookRepository:
    webhookRouteMocks.createPolarWebhookRepository,
}));

describe("Polar webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookRouteMocks.createPolarWebhookRepository.mockReturnValue({
      markEventProcessed: webhookRouteMocks.markEventProcessed,
      upsertSubscription: webhookRouteMocks.upsertSubscription,
    });
    webhookRouteMocks.markEventProcessed.mockResolvedValue("inserted");
    webhookRouteMocks.verifyPolarWebhook.mockReturnValue({
      eventId: "evt_1",
      type: "subscription.active",
      data: { id: "sub_1" },
    });
    webhookRouteMocks.toSubscriptionUpsert.mockReturnValue({
      userId: "user-1",
      polarSubscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    });
  });

  it("returns 401 when raw-body signature verification fails", async () => {
    webhookRouteMocks.verifyPolarWebhook.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });
    const request = new NextRequest(
      "https://finsight.test/api/webhook/polar",
      {
        method: "POST",
        body: "{\"type\":\"subscription.active\"}",
        headers: {
          "webhook-id": "evt_1",
          "webhook-timestamp": "1710000000",
          "webhook-signature": "bad",
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_signature",
    });
    expect(webhookRouteMocks.verifyPolarWebhook).toHaveBeenCalledWith(
      "{\"type\":\"subscription.active\"}",
      expect.objectContaining({
        "webhook-id": "evt_1",
        "webhook-timestamp": "1710000000",
        "webhook-signature": "bad",
      }),
    );
    expect(webhookRouteMocks.markEventProcessed).not.toHaveBeenCalled();
    expect(webhookRouteMocks.upsertSubscription).not.toHaveBeenCalled();
  });

  it("returns 200 and skips upsert for an already processed event_id", async () => {
    webhookRouteMocks.markEventProcessed.mockResolvedValueOnce(
      "already_processed",
    );
    const request = new NextRequest(
      "https://finsight.test/api/webhook/polar",
      {
        method: "POST",
        body: "raw-body",
        headers: {
          "webhook-id": "evt_1",
          "webhook-timestamp": "1710000000",
          "webhook-signature": "sig",
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(webhookRouteMocks.markEventProcessed).toHaveBeenCalledWith("evt_1");
    expect(webhookRouteMocks.toSubscriptionUpsert).not.toHaveBeenCalled();
    expect(webhookRouteMocks.upsertSubscription).not.toHaveBeenCalled();
  });

  it("pre-inserts a new event_id before upserting the subscription", async () => {
    const request = new NextRequest(
      "https://finsight.test/api/webhook/polar",
      {
        method: "POST",
        body: "raw-body",
        headers: {
          "webhook-id": "evt_1",
          "webhook-timestamp": "1710000000",
          "webhook-signature": "sig",
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(webhookRouteMocks.markEventProcessed).toHaveBeenCalledWith("evt_1");
    expect(webhookRouteMocks.toSubscriptionUpsert).toHaveBeenCalledWith({
      eventId: "evt_1",
      type: "subscription.active",
      data: { id: "sub_1" },
    });
    expect(webhookRouteMocks.upsertSubscription).toHaveBeenCalledWith({
      userId: "user-1",
      polarSubscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    });
    expect(
      webhookRouteMocks.markEventProcessed.mock.invocationCallOrder[0],
    ).toBeLessThan(
      webhookRouteMocks.upsertSubscription.mock.invocationCallOrder[0],
    );
  });
});
