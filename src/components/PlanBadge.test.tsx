import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlanBadge } from "./PlanBadge";

describe("PlanBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Free label for the free tier", () => {
    render(<PlanBadge tier="free" />);

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });

  it("renders the Pro label for the pro tier", () => {
    render(<PlanBadge tier="pro" />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
  });
});
