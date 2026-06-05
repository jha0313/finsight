import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ProInsights } from "@/types/analysis";

import { InsightsPanel } from "./InsightsPanel";

const insights: ProInsights = {
  summary: "식비와 교통비가 지출의 대부분을 차지합니다.",
  insights: ["반복 결제를 먼저 점검하세요.", "고정비 절감 여지가 있습니다."],
};

describe("InsightsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders active Pro insight summary and insight bullets", () => {
    render(<InsightsPanel status="active" insights={insights} />);

    expect(
      screen.getByText("식비와 교통비가 지출의 대부분을 차지합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("반복 결제를 먼저 점검하세요.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pro로 업그레이드" }),
    ).not.toBeInTheDocument();
  });

  it("renders a locked state with a checkout upgrade CTA", () => {
    render(<InsightsPanel status="locked" />);

    expect(screen.getByText("Pro 분석 잠금")).toBeInTheDocument();

    const upgradeButton = screen.getByRole("button", {
      name: "Pro로 업그레이드",
    });
    expect(upgradeButton).toBeInTheDocument();
    expect(screen.getByText("Polar가 결제와 세금 처리를 담당합니다.")).toBeInTheDocument();

    const checkoutForm = upgradeButton.closest("form");
    expect(checkoutForm).toHaveAttribute("action", "/api/checkout");
    expect(checkoutForm).toHaveAttribute("method", "post");
  });

  it("renders Sonnet insights alongside the upgrade CTA in the locked state", () => {
    render(<InsightsPanel status="locked" insights={insights} />);

    expect(
      screen.getByText("식비와 교통비가 지출의 대부분을 차지합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("반복 결제를 먼저 점검하세요.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pro로 업그레이드" }),
    ).toBeInTheDocument();
  });

  it("shows a generating progress state (no upgrade CTA) while Pro analysis is pending", () => {
    // 서버 Pro 확정 + Opus 생성 중: locked로 저장돼 있어도 pending이 우선한다.
    render(<InsightsPanel status="locked" pending />);

    expect(
      screen.getByText(
        "Pro 심층 분석(Opus)을 생성하는 중입니다. 잠시만 기다려 주세요.",
      ),
    ).toBeInTheDocument();
    // 이미 Pro이므로 업그레이드 CTA도, 잠금 문구도 보이지 않는다.
    expect(
      screen.queryByRole("button", { name: "Pro로 업그레이드" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Pro 분석 잠금")).not.toBeInTheDocument();
  });

  it("renders unavailable copy without the upgrade CTA", () => {
    render(<InsightsPanel status="unavailable" />);

    expect(
      screen.getByText("AI 인사이트를 사용할 수 없습니다"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "지금은 Pro 분석을 시작할 수 없습니다. 규칙 기반 분석은 그대로 유지됩니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pro로 업그레이드" }),
    ).not.toBeInTheDocument();
  });
});
