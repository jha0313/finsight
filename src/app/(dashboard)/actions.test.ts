import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  signOutCurrentUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  signOutCurrentUser: actionMocks.signOutCurrentUser,
}));

vi.mock("next/navigation", () => ({
  redirect: actionMocks.redirect,
}));

import { signOutAction } from "./actions";

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out and redirects to the login page", async () => {
    actionMocks.signOutCurrentUser.mockResolvedValue(undefined);

    await signOutAction();

    expect(actionMocks.signOutCurrentUser).toHaveBeenCalledTimes(1);
    expect(actionMocks.redirect).toHaveBeenCalledWith("/login");
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
