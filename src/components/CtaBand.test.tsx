import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CtaBand } from "./CtaBand";

describe("CtaBand", () => {
  it("renders a dark closing band with a single primary CTA", () => {
    render(
      <CtaBand
        ctaHref="/login"
        ctaLabel="Google로 시작"
        description="첫 명세서를 올리면 지출 구조와 이상 거래를 바로 확인합니다."
        title="지금 첫 명세서를 분석합니다"
      />,
    );

    expect(screen.getByLabelText("지금 첫 명세서를 분석합니다")).toHaveClass(
      "bg-surface-dark",
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "지금 첫 명세서를 분석합니다",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google로 시작" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
