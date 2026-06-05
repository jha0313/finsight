import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsView, type SettingsViewProps } from "./SettingsView";

function renderSettings(overrides: Partial<SettingsViewProps> = {}) {
  render(
    <SettingsView
      cancelAtPeriodEnd={false}
      email="ava@example.com"
      renewalLabel={null}
      signOutAction={vi.fn()}
      tier="free"
      {...overrides}
    />,
  );
}

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an upgrade call-to-action for the free tier", () => {
    renderSettings({ tier: "free" });

    const upgrade = screen.getByRole("button", { name: /Pro로 업그레이드/ });
    expect(upgrade.closest("form")).toHaveAttribute("action", "/api/checkout");
  });

  it("shows the renewal date and a cancel action for an active pro subscription", () => {
    renderSettings({ tier: "pro", renewalLabel: "2026.07.04" });

    expect(screen.getByText(/2026\.07\.04/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pro로 업그레이드/ }),
    ).not.toBeInTheDocument();

    const cancel = screen.getByRole("button", { name: "구독 취소" });
    expect(cancel.closest("form")).toHaveAttribute(
      "action",
      "/api/subscription/cancel",
    );
  });

  it("shows a resume action and end-of-period notice when cancellation is scheduled", () => {
    renderSettings({
      tier: "pro",
      cancelAtPeriodEnd: true,
      renewalLabel: "2026.07.04",
    });

    expect(screen.getByText(/2026\.07\.04/)).toBeInTheDocument();
    expect(screen.getByText(/Free로 전환/)).toBeInTheDocument();

    const resume = screen.getByRole("button", { name: "구독 유지하기" });
    const form = resume.closest("form");
    expect(form).toHaveAttribute("action", "/api/subscription/cancel");
    expect(form?.querySelector('input[name="action"]')).toHaveAttribute(
      "value",
      "resume",
    );
    expect(
      screen.queryByRole("button", { name: "구독 취소" }),
    ).not.toBeInTheDocument();
  });

  it("renders the account email and a logout control", () => {
    renderSettings({ tier: "free" });

    expect(screen.getByText("ava@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();
  });
});
