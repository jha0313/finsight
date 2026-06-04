import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getSampleDemoAnalysis } from "./sample-demo";
import { SampleDemoSection } from "./SampleDemoSection";

describe("SampleDemoSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders charts, anomalies, and static Korean insights from the sample result", async () => {
    render(<SampleDemoSection analysis={await getSampleDemoAnalysis()} />);

    expect(
      screen.getByRole("region", { name: "샘플 명세서 데모" }),
    ).toBeInTheDocument();
    expect(screen.getByText("카테고리별 지출")).toBeInTheDocument();
    expect(screen.getByText("기간별 지출 추이")).toBeInTheDocument();
    expect(screen.getByText("이상 거래와 구독 누수")).toBeInTheDocument();
    expect(screen.getByText("YouTube Premium")).toBeInTheDocument();
    expect(screen.getByText("샘플 명세서")).toBeInTheDocument();
    expect(
      screen.getByText("반복 결제 후보를 먼저 확인하고 필요 없는 구독을 점검합니다."),
    ).toBeInTheDocument();
  });
});
