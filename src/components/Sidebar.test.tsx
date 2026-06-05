import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: navigationMocks.usePathname,
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders dashboard and settings navigation links", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    render(<Sidebar email="ava@example.com" tier="free" signOutAction={vi.fn()} />);

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

    render(<Sidebar email="ava@example.com" tier="free" signOutAction={vi.fn()} />);

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

    render(<Sidebar email="ava@example.com" tier="pro" signOutAction={vi.fn()} />);

    expect(screen.getByRole("link", { name: "대시보드" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the plan badge and the account email", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    render(<Sidebar email="ava@example.com" tier="pro" signOutAction={vi.fn()} />);

    expect(screen.getAllByText("Pro").length).toBeGreaterThan(0);
    expect(screen.getByText("ava@example.com")).toBeInTheDocument();
  });

  it("renders a logout control", () => {
    navigationMocks.usePathname.mockReturnValue("/dashboard");

    render(<Sidebar email={null} tier="free" signOutAction={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "로그아웃" }),
    ).toBeInTheDocument();
  });
});
