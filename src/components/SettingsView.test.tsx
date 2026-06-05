import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an upgrade call-to-action for the free tier", () => {
    render(
      <SettingsView
        email="ava@example.com"
        renewalLabel={null}
        signOutAction={vi.fn()}
        tier="free"
      />,
    );

    const upgrade = screen.getByRole("button", { name: /Pro로 업그레이드/ });
    expect(upgrade).toBeInTheDocument();
    expect(upgrade.closest("form")).toHaveAttribute("action", "/api/checkout");
  });

  it("shows the renewal date and no upgrade CTA for the pro tier", () => {
    render(
      <SettingsView
        email="ava@example.com"
        renewalLabel="2026.07.04"
        signOutAction={vi.fn()}
        tier="pro"
      />,
    );

    expect(screen.getByText(/2026\.07\.04/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pro로 업그레이드/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the account email and a logout control", () => {
    render(
      <SettingsView
        email="ava@example.com"
        renewalLabel={null}
        signOutAction={vi.fn()}
        tier="free"
      />,
    );

    expect(screen.getByText("ava@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();
  });
});
