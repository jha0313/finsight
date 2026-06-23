import { beforeEach, describe, expect, it, vi } from "vitest";

class MockPostHog {
  capture = vi.fn();
  captureException = vi.fn();
  flush = vi.fn().mockResolvedValue(undefined);
  shutdown = vi.fn();
}

vi.mock("posthog-node", () => ({
  PostHog: MockPostHog,
}));

describe("getPostHogClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the same instance on multiple calls (singleton)", async () => {
    const { getPostHogClient } = await import("./analytics");
    const a = getPostHogClient();
    const b = getPostHogClient();

    expect(a).toBeDefined();
    expect(a).toBe(b);
  });
});

describe("createPostHogAnalytics", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("forwards capture to the posthog-node client unchanged", async () => {
    const { createPostHogAnalytics, getPostHogClient } = await import(
      "./analytics"
    );
    const analytics = createPostHogAnalytics();
    const client = getPostHogClient() as unknown as MockPostHog;

    analytics.capture({
      distinctId: "user-1",
      event: "analysis_completed",
      properties: { tier: "pro", source: "upload" },
    });

    expect(client.capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "analysis_completed",
      properties: { tier: "pro", source: "upload" },
    });
  });

  it("delegates flush to the client", async () => {
    const { createPostHogAnalytics, getPostHogClient } = await import(
      "./analytics"
    );
    const analytics = createPostHogAnalytics();
    const client = getPostHogClient() as unknown as MockPostHog;

    await analytics.flush();

    expect(client.flush).toHaveBeenCalledTimes(1);
  });
});

describe("captureServerException", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("captures the exception with context and flushes immediately", async () => {
    const { captureServerException, getPostHogClient } = await import(
      "./analytics"
    );
    const client = getPostHogClient() as unknown as MockPostHog;
    const error = new Error("route blew up");

    await captureServerException(error, {
      distinctId: "user-1",
      properties: { route: "/api/analyze" },
    });

    expect(client.captureException).toHaveBeenCalledWith(error, "user-1", {
      route: "/api/analyze",
    });
    expect(client.flush).toHaveBeenCalledTimes(1);
  });
});
