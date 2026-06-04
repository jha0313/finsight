import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero } from "./Hero";

describe("Hero", () => {
  it("renders a dark landing hero with login CTA, mono numbers, and demo slot", () => {
    render(
      <Hero
        brandName="finsight"
        ctaHref="/login"
        ctaLabel="Google로 시작"
        description="CSV 명세서를 올리면 지출 구조와 이상 거래를 먼저 정리하고, AI가 절약 인사이트를 덧붙입니다."
        headline="명세서에서 지출의 구조를 읽습니다"
        preview={{
          amount: "₩2,480,000",
          amountLabel: "이번 달 지출",
          delta: "-18%",
          period: "2026.06",
          rows: [
            { label: "식비", tone: "down", value: "₩842,000" },
            { label: "환불", tone: "up", value: "-₩24,000" },
          ],
          title: "정적 대시보드 미리보기",
        }}
        demoSlot={{
          description: "다음 step에서 샘플 명세서 흐름을 연결합니다.",
          label: "샘플 데모",
          title: "샘플 명세서 데모 영역",
        }}
      />,
    );

    expect(screen.getByRole("banner")).toHaveClass("bg-surface-dark");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "명세서에서 지출의 구조를 읽습니다",
    );
    expect(screen.getByRole("link", { name: "Google로 시작" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("₩2,480,000")).toHaveClass("num");
    expect(screen.getByText("-18%")).toHaveClass("num");
    expect(screen.getByText("샘플 명세서 데모 영역")).toBeInTheDocument();
  });
});
