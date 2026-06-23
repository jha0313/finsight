import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureServerException: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/posthog/analytics", () => ({
  captureServerException: mocks.captureServerException,
}));

describe("onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("captures the server exception with route and method on the nodejs runtime", async () => {
    const { onRequestError } = await import("./instrumentation");
    const error = new Error("boom");

    await onRequestError(
      error,
      { path: "/api/analyze", method: "POST", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/api/analyze",
        routeType: "route",
      },
    );

    expect(mocks.captureServerException).toHaveBeenCalledWith(error, {
      properties: { route: "/api/analyze", method: "POST" },
    });
  });

  it("skips capture on non-nodejs runtimes (edge)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { onRequestError } = await import("./instrumentation");

    await onRequestError(
      new Error("boom"),
      { path: "/api/analyze", method: "POST", headers: {} },
      { routerKind: "App Router", routePath: "/", routeType: "route" },
    );

    expect(mocks.captureServerException).not.toHaveBeenCalled();
  });
});
