import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TrendPoint } from "@/types/analysis";

import { TrendLine } from "./TrendLine";

const trend: TrendPoint[] = [
  { period: "2026-05", total: "90000.00" },
  { period: "2026-06", total: "150000.00" },
];

describe("TrendLine", () => {
  it("renders monthly trend labels and formatted totals", () => {
    render(<TrendLine data={trend} currency="KRW" />);

    expect(
      screen.getByRole("img", { name: "기간별 지출 추이" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026.06")).toHaveClass("num");
    expect(screen.getAllByText("₩150,000.00")[0]).toHaveClass("num");
  });
});
