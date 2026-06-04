import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AnalyzeResponse } from "@/types/analysis";

import { DashboardResults } from "./DashboardResults";

const baseResponse: AnalyzeResponse = {
  tier: "free",
  free: {
    byCategory: [
      { category: "food", total: "120000.00", count: 8 },
      { category: "transport", total: "30000.00", count: 4 },
    ],
    trend: [
      { period: "2026-05", total: "90000.00" },
      { period: "2026-06", total: "60000.00" },
    ],
    anomalies: [
      {
        kind: "subscription_leak",
        merchant: "스트리밍 서비스",
        detail: "최근 3개월 동안 반복 결제가 확인되었습니다.",
      },
    ],
  },
  pro: {
    status: "locked",
  },
  warnings: ["요약 행 1개를 제외했습니다."],
};

describe("DashboardResults", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders free charts, anomalies, warnings, and a locked Pro preview", () => {
    render(<DashboardResults response={baseResponse} />);

    expect(screen.getByText("카테고리별 지출")).toBeInTheDocument();
    expect(screen.getByText("기간별 지출 추이")).toBeInTheDocument();
    expect(screen.getByText("이상 거래와 구독 누수")).toBeInTheDocument();
    expect(screen.getByText("식비")).toBeInTheDocument();
    expect(screen.getByText("스트리밍 서비스")).toBeInTheDocument();
    expect(screen.getByText("Pro 분석 잠금")).toBeInTheDocument();
    expect(screen.getByText("요약 행 1개를 제외했습니다.")).toBeInTheDocument();
  });

  it("renders active Pro insights from the response contract", () => {
    render(
      <DashboardResults
        response={{
          ...baseResponse,
          tier: "pro",
          pro: {
            status: "active",
            insights: {
              summary: "고정비보다 식비 변동성이 더 큽니다.",
              insights: ["평일 점심 지출을 먼저 조정해볼 수 있습니다."],
            },
          },
          warnings: undefined,
        }}
      />,
    );

    expect(screen.getByText("고정비보다 식비 변동성이 더 큽니다.")).toBeInTheDocument();
    expect(
      screen.getByText("평일 점심 지출을 먼저 조정해볼 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("renders unavailable Pro insights while preserving free analysis", () => {
    render(
      <DashboardResults
        response={{
          ...baseResponse,
          pro: {
            status: "unavailable",
          },
        }}
      />,
    );

    expect(screen.getByText("카테고리별 지출")).toBeInTheDocument();
    expect(
      screen.getByText("AI 인사이트를 사용할 수 없습니다"),
    ).toBeInTheDocument();
  });
});
