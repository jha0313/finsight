import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureGrid } from "./FeatureGrid";

describe("FeatureGrid", () => {
  it("renders the white value section and the reserved sample demo slot", () => {
    render(
      <FeatureGrid
        description="CSV 업로드부터 분석 요약까지 한 화면에서 확인합니다."
        demoSlot={{
          description: "실제 샘플 분석은 다음 step에서 이 영역에 들어갑니다.",
          label: "데모 슬롯",
          title: "샘플 명세서 분석 자리",
        }}
        eyebrow="핵심 가치"
        features={[
          {
            description: "카드와 은행 CSV를 표준 파서로 먼저 읽습니다.",
            title: "CSV 업로드",
          },
          {
            description: "카테고리별 지출과 기간별 흐름을 정리합니다.",
            title: "지출 구조",
          },
          {
            description: "반복 결제와 큰 변동을 조용히 드러냅니다.",
            title: "이상 거래",
          },
        ]}
        title="명세서를 읽는 첫 화면"
      />,
    );

    expect(screen.getByLabelText("핵심 가치")).toHaveClass("bg-canvas");
    expect(screen.getByRole("heading", { name: "명세서를 읽는 첫 화면" }))
      .toBeInTheDocument();
    expect(screen.getByText("CSV 업로드")).toBeInTheDocument();
    expect(screen.getByText("지출 구조")).toBeInTheDocument();
    expect(screen.getByText("샘플 명세서 분석 자리")).toBeInTheDocument();
  });
});
