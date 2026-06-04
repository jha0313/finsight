import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryBreakdown } from "@/types/analysis";

import { CategoryDonut } from "./CategoryDonut";

const categories: CategoryBreakdown[] = [
  { category: "food", total: "120000.00", count: 8 },
  { category: "transport", total: "30000.00", count: 4 },
];

describe("CategoryDonut", () => {
  it("renders category labels, formatted money, and mono percentages", () => {
    render(<CategoryDonut data={categories} currency="KRW" />);

    expect(
      screen.getByRole("img", { name: "카테고리별 지출" }),
    ).toBeInTheDocument();
    expect(screen.getByText("식비")).toBeInTheDocument();
    expect(screen.getByText("₩120,000.00")).toHaveClass("num");
    expect(screen.getByText("80.0%")).toHaveClass("num");
  });
});
