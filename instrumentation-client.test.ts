import { describe, it, vi, expect } from "vitest";

const mockInit = vi.fn();

vi.mock("posthog-js", () => ({
  default: { init: mockInit },
}));

describe("instrumentation-client", () => {
  it("initializes PostHog with environment variables", async () => {
    await import("./instrumentation-client");
    expect(mockInit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        api_host: "/ingest",
        ui_host: "https://us.posthog.com",
        capture_exceptions: true,
      }),
    );
  });
});
