import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders a compact numeric stat with mono value text", () => {
    render(
      <StatCard
        label="총 지출"
        value="₩150,000.00"
        detail="최근 명세서 기준"
      />,
    );

    expect(screen.getByText("총 지출")).toBeInTheDocument();
    expect(screen.getByText("₩150,000.00")).toHaveClass("num");
    expect(screen.getByText("최근 명세서 기준")).toBeInTheDocument();
  });
});
