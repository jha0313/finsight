import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProInsights } from "@/types/analysis";

import { InsightsPanel } from "./InsightsPanel";

const insights: ProInsights = {
  summary: "식비와 교통비가 지출의 대부분을 차지합니다.",
  insights: ["반복 결제를 먼저 점검하세요.", "고정비 절감 여지가 있습니다."],
};

describe("InsightsPanel", () => {
  it("renders active Pro insight summary and insight bullets", () => {
    render(<InsightsPanel status="active" insights={insights} />);

    expect(
      screen.getByText("식비와 교통비가 지출의 대부분을 차지합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("반복 결제를 먼저 점검하세요.")).toBeInTheDocument();
  });

  it("renders a locked state without requiring insights", () => {
    render(<InsightsPanel status="locked" />);

    expect(screen.getByText("Pro 분석 잠금")).toBeInTheDocument();
  });
});
