import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitHubDispatch, verifyPostHogWebhook } from "./webhook";

describe("verifyPostHogWebhook", () => {
  beforeEach(() => {
    vi.stubEnv("ONCALL_WEBHOOK_SECRET", "s3cret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when the shared secret env is not configured", () => {
    vi.stubEnv("ONCALL_WEBHOOK_SECRET", "");

    expect(() =>
      verifyPostHogWebhook("{}", { authorization: "Bearer s3cret" }),
    ).toThrow(/ONCALL_WEBHOOK_SECRET/);
  });

  it("throws when the bearer secret does not match", () => {
    expect(() =>
      verifyPostHogWebhook("{}", { authorization: "Bearer wrong" }),
    ).toThrow(/secret/);
  });

  it("throws when the body is not valid JSON", () => {
    expect(() =>
      verifyPostHogWebhook("not-json", { authorization: "Bearer s3cret" }),
    ).toThrow(/JSON/);
  });

  it("accepts a valid secret and namespaces the event id with the explicit payload id", () => {
    const alert = verifyPostHogWebhook(
      JSON.stringify({ id: "evt_42", message: "boom" }),
      { authorization: "Bearer s3cret" },
    );

    expect(alert.eventId).toBe("posthog:evt_42");
    expect(alert.payload).toEqual({ id: "evt_42", message: "boom" });
  });

  it("also accepts the secret via the x-oncall-secret header", () => {
    const alert = verifyPostHogWebhook(JSON.stringify({ id: "evt_7" }), {
      "x-oncall-secret": "s3cret",
    });

    expect(alert.eventId).toBe("posthog:evt_7");
  });

  it("derives a deterministic hash-based id when no explicit id is present", () => {
    const body = JSON.stringify({ message: "no id here" });
    const headers = { authorization: "Bearer s3cret" };

    const first = verifyPostHogWebhook(body, headers);
    const second = verifyPostHogWebhook(body, headers);

    // 동일 본문 재전송은 동일 멱등 키여야 한다(중복 dispatch 방지).
    expect(first.eventId).toBe(second.eventId);
    expect(first.eventId).toMatch(/^posthog:[a-f0-9]{64}$/);
  });

  it("prefers error-tracking issue id + triggered_at when present", () => {
    const alert = verifyPostHogWebhook(
      JSON.stringify({ issue: { id: "iss_1" }, triggered_at: "2026-06-23T00:00:00Z" }),
      { authorization: "Bearer s3cret" },
    );

    expect(alert.eventId).toBe("posthog:iss_1:2026-06-23T00:00:00Z");
  });

  it("dedups a re-delivered spike but re-wakes on a fresh spike of the same issue", () => {
    const headers = { authorization: "Bearer s3cret" };
    const spike = (triggeredAt: string) =>
      verifyPostHogWebhook(
        JSON.stringify({ issue: { id: "iss_spike" }, triggered_at: triggeredAt }),
        headers,
      ).eventId;

    // 같은 급증의 재전송(동일 triggered_at)은 동일 키 → 멱등으로 dispatch 1회.
    expect(spike("2026-06-23T11:00:00Z")).toBe(spike("2026-06-23T11:00:00Z"));
    // 다른 시각에 다시 급증하면 새 키 → triage를 다시 깨운다(놓치지 않음).
    expect(spike("2026-06-23T11:00:00Z")).not.toBe(spike("2026-06-23T12:30:00Z"));
  });
});

describe("createGitHubDispatch", () => {
  beforeEach(() => {
    vi.stubEnv("GH_DISPATCH_TOKEN", "ghp_test");
    vi.stubEnv("GH_DISPATCH_REPO", "jha0313/finsight");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("POSTs a repository_dispatch with event_type oncall-alert and the payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await createGitHubDispatch().dispatch({ message: "boom" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/jha0313/finsight/dispatches");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      event_type: "oncall-alert",
      client_payload: { message: "boom" },
    });
  });

  it("throws when GitHub responds with a non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 403 }),
    );

    await expect(
      createGitHubDispatch().dispatch({ message: "boom" }),
    ).rejects.toThrow(/repository_dispatch failed: 403/);
  });

  it("throws when the dispatch token env is missing", async () => {
    vi.stubEnv("GH_DISPATCH_TOKEN", "");

    await expect(
      createGitHubDispatch().dispatch({ message: "boom" }),
    ).rejects.toThrow(/GH_DISPATCH_TOKEN/);
  });
});
