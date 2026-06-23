import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  signOutCurrentUser: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  redirect: vi.fn(),
  posthogCapture: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  signOutCurrentUser: actionMocks.signOutCurrentUser,
  getCurrentUser: actionMocks.getCurrentUser,
}));

vi.mock("next/navigation", () => ({
  redirect: actionMocks.redirect,
}));

vi.mock("@/services/posthog/analytics", () => ({
  getPostHogClient: () => ({ capture: actionMocks.posthogCapture }),
}));

import { signOutAction } from "./actions";

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out and redirects to the landing page", async () => {
    actionMocks.signOutCurrentUser.mockResolvedValue(undefined);

    await signOutAction();

    expect(actionMocks.signOutCurrentUser).toHaveBeenCalledTimes(1);
    expect(actionMocks.redirect).toHaveBeenCalledWith("/");
  });

  it("redirects only after sign-out resolves", async () => {
    const order: string[] = [];
    actionMocks.signOutCurrentUser.mockImplementation(async () => {
      order.push("signOut");
    });
    actionMocks.redirect.mockImplementation(() => {
      order.push("redirect");
    });

    await signOutAction();

    expect(order).toEqual(["signOut", "redirect"]);
  });
});
