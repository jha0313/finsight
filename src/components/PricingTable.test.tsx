import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PricingTable } from "./PricingTable";

describe("PricingTable", () => {
  it("renders Free and Pro plans with login CTAs and mono price text", () => {
    render(
      <PricingTable
        description="Free 분석으로 시작하고, 더 깊은 절약 판단이 필요할 때 Pro를 활성화합니다."
        eyebrow="가격"
        plans={[
          {
            ctaHref: "/login",
            ctaLabel: "Free로 시작",
            description: "규칙·통계 분석과 Sonnet 요약을 제공합니다.",
            features: ["카테고리별 지출", "기간별 지출 추이"],
            name: "Free",
            price: "₩0",
          },
          {
            ctaHref: "/login",
            ctaLabel: "Pro 시작",
            description: "Opus 심층 분석으로 절약 인사이트를 더 깊게 봅니다.",
            features: ["Opus 심층 분석", "고급 절약 인사이트"],
            name: "Pro",
            price: "구독",
          },
        ]}
        title="필요한 깊이만 선택합니다"
      />,
    );

    expect(screen.getByLabelText("가격")).toHaveClass("bg-canvas");
    expect(screen.getByText("₩0")).toHaveClass("num");
    expect(screen.getByText("구독")).toHaveClass("num");
    expect(screen.getByRole("link", { name: "Free로 시작" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Pro 시작" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
