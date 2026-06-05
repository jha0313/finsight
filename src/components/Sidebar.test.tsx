import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: navigationMocks.usePathname,
}));

import { Sidebar, type SidebarProps } from "./Sidebar";

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  render(
    <Sidebar
      cancelAtPeriodEnd={false}
      email="ava@example.com"
      renewalLabel={null}
      signOutAction={vi.fn()}
      tier="free"
      {...overrides}
    />,
  );
}

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders dashboard and settings navigation links", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    renderSidebar();

    expect(screen.getByRole("link", { name: "대시보드" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "설정" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
  });

  it("marks the active route with aria-current based on the pathname", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard/settings");

    renderSidebar();

    expect(screen.getByRole("link", { name: "설정" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "대시보드" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps the dashboard link inactive on nested routes", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard/settings");

    renderSidebar({ tier: "pro" });

    expect(screen.getByRole("link", { name: "대시보드" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the plan badge and the account email through the user menu", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    renderSidebar({ tier: "pro" });

    expect(screen.getAllByText("Pro").length).toBeGreaterThan(0);
    expect(screen.getByText("ava@example.com")).toBeInTheDocument();
  });

  it("renders the account menu trigger", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    renderSidebar({ email: null });

    expect(
      screen.getByRole("button", { name: "계정 메뉴 열기" }),
    ).toBeInTheDocument();
  });
});
