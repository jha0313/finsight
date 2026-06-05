import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Tier } from "@/types/tier";

import { UserMenu } from "./UserMenu";

type Overrides = {
  email?: string | null;
  tier?: Tier;
  cancelAtPeriodEnd?: boolean;
  renewalLabel?: string | null;
};

function renderMenu(overrides: Overrides = {}) {
  render(
    <UserMenu
      cancelAtPeriodEnd={overrides.cancelAtPeriodEnd ?? false}
      email={overrides.email === undefined ? "ava@example.com" : overrides.email}
      renewalLabel={overrides.renewalLabel ?? null}
      signOutAction={vi.fn()}
      tier={overrides.tier ?? "free"}
    />,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "계정 메뉴 열기" }));
}

describe("UserMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the menu closed until the trigger is clicked", () => {
    renderMenu();

    expect(
      screen.queryByRole("link", { name: "설정" }),
    ).not.toBeInTheDocument();

    openMenu();

    expect(screen.getByRole("link", { name: "설정" })).toBeInTheDocument();
  });

  it("shows an upgrade action for the free tier", () => {
    renderMenu({ tier: "free" });
    openMenu();

    const upgrade = screen.getByRole("button", { name: /Pro로 업그레이드/ });
    expect(upgrade.closest("form")).toHaveAttribute("action", "/api/checkout");
  });

  it("shows a cancel action for an active pro subscription", () => {
    renderMenu({ tier: "pro", cancelAtPeriodEnd: false });
    openMenu();

    const cancel = screen.getByRole("button", { name: "구독 취소" });
    expect(cancel.closest("form")).toHaveAttribute(
      "action",
      "/api/subscription/cancel",
    );
    expect(
      screen.queryByRole("button", { name: "구독 유지하기" }),
    ).not.toBeInTheDocument();
  });

  it("shows a resume action and end-of-period notice when cancellation is scheduled", () => {
    renderMenu({
      tier: "pro",
      cancelAtPeriodEnd: true,
      renewalLabel: "2026.07.04",
    });
    openMenu();

    const resume = screen.getByRole("button", { name: "구독 유지하기" });
    const form = resume.closest("form");
    expect(form).toHaveAttribute("action", "/api/subscription/cancel");
    expect(form?.querySelector('input[name="action"]')).toHaveAttribute(
      "value",
      "resume",
    );
    expect(screen.getByText(/2026\.07\.04/)).toBeInTheDocument();
  });

  it("always exposes settings and logout", () => {
    renderMenu({ tier: "pro" });
    openMenu();

    expect(screen.getByRole("link", { name: "설정" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(
      screen.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();
  });
});
