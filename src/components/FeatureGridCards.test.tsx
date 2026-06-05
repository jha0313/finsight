import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureGridCards } from "./FeatureGridCards";

describe("FeatureGridCards", () => {
  beforeEach(() => {
    // IntersectionObserver 미정의 → useInView가 inView=true 폴백 → reveal 콘텐츠 노출 +
    // data-inview="true" 셋팅(모션 정지 환경과 동일하게 최종 상태).
    vi.stubGlobal("IntersectionObserver", undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const features = [
    { description: "표준 파서가 먼저 읽습니다.", title: "CSV 업로드" },
    { description: "지출 구조를 정리합니다.", title: "지출 구조" },
    { description: "이상 거래를 드러냅니다.", title: "이상 거래" },
    { description: "AI가 절약을 판단합니다.", title: "절약 인사이트" },
  ];

  it("renders every feature title and description", () => {
    render(<FeatureGridCards features={features} />);

    for (const feature of features) {
      expect(screen.getByText(feature.title)).toBeInTheDocument();
      expect(screen.getByText(feature.description)).toBeInTheDocument();
    }
  });

  it("marks each card with the reveal motion attribute when in view", () => {
    render(<FeatureGridCards features={features} />);

    const card = screen.getByText("CSV 업로드").closest("article");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("motion-fade-rise");
    expect(card).toHaveAttribute("data-inview", "true");
  });

  it("gives only the AI insight card the gradient border accent", () => {
    render(<FeatureGridCards features={features} />);

    const aiCard = screen.getByText("절약 인사이트").closest("article");
    const plainCard = screen.getByText("CSV 업로드").closest("article");

    expect(aiCard).toHaveClass("ai-border-gradient");
    expect(plainCard).not.toHaveClass("ai-border-gradient");
  });

  it("can mark the AI card explicitly via the ai flag", () => {
    render(
      <FeatureGridCards
        features={[
          { ai: true, description: "심층 분석.", title: "다른 제목" },
          { description: "일반 카드.", title: "CSV 업로드" },
        ]}
      />,
    );

    expect(screen.getByText("다른 제목").closest("article")).toHaveClass(
      "ai-border-gradient",
    );
    expect(screen.getByText("CSV 업로드").closest("article")).not.toHaveClass(
      "ai-border-gradient",
    );
  });
});
