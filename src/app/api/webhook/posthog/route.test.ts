import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const routeMocks = vi.hoisted(() => ({
  verifyPostHogWebhook: vi.fn(),
  createGitHubDispatch: vi.fn(),
  createOncallWebhookRepository: vi.fn(),
  markEventProcessed: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/services/posthog/webhook", () => ({
  verifyPostHogWebhook: routeMocks.verifyPostHogWebhook,
  createGitHubDispatch: routeMocks.createGitHubDispatch,
}));

vi.mock("@/services/supabase/service-role", () => ({
  createOncallWebhookRepository: routeMocks.createOncallWebhookRepository,
}));

function makeRequest(body: string): NextRequest {
  return new NextRequest("https://finsight.test/api/webhook/posthog", {
    method: "POST",
    body,
    headers: { authorization: "Bearer s3cret" },
  });
}

describe("PostHog webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.createGitHubDispatch.mockReturnValue({
      dispatch: routeMocks.dispatch,
    });
    routeMocks.createOncallWebhookRepository.mockReturnValue({
      markEventProcessed: routeMocks.markEventProcessed,
    });
    routeMocks.markEventProcessed.mockResolvedValue("inserted");
    routeMocks.verifyPostHogWebhook.mockReturnValue({
      eventId: "posthog:evt_1",
      payload: { message: "boom" },
    });
  });

  it("returns 401 when the shared-secret verification fails", async () => {
    routeMocks.verifyPostHogWebhook.mockImplementationOnce(() => {
      throw new Error("invalid PostHog webhook secret");
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_signature",
    });
    expect(routeMocks.markEventProcessed).not.toHaveBeenCalled();
    expect(routeMocks.dispatch).not.toHaveBeenCalled();
  });

  it("returns 200 duplicate and does not dispatch a replayed event", async () => {
    routeMocks.markEventProcessed.mockResolvedValueOnce("already_processed");

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(routeMocks.markEventProcessed).toHaveBeenCalledWith("posthog:evt_1");
    expect(routeMocks.dispatch).not.toHaveBeenCalled();
  });

  it("marks the event then dispatches the payload for a new event", async () => {
    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(routeMocks.markEventProcessed).toHaveBeenCalledWith("posthog:evt_1");
    expect(routeMocks.dispatch).toHaveBeenCalledWith({ message: "boom" });
    expect(
      routeMocks.markEventProcessed.mock.invocationCallOrder[0],
    ).toBeLessThan(routeMocks.dispatch.mock.invocationCallOrder[0]);
  });
});
