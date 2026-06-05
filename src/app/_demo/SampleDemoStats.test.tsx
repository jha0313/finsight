import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SampleDemoStats } from "./SampleDemoStats";

// reduced-motion / IntersectionObserver 미지원 폴백 경로에서는 카운트업이 즉시 최종값으로
// 정착하므로, 테스트는 최종 표시 문자열만 검증한다(rAF 타이밍에 의존하지 않음).
function stubReducedMotion() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("SampleDemoStats", () => {
  beforeEach(() => {
    stubReducedMotion();
    // IntersectionObserver 미정의 → useInView가 inView=true 폴백 → start=true
    vi.stubGlobal("IntersectionObserver", undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the three stat labels and details", () => {
    render(
      <SampleDemoStats
        anomalyCount={10}
        subscriptionLeakCount={1}
        totalSpend="1797550.00"
        transactionCount={30}
      />,
    );

    expect(screen.getByText("거래 수")).toBeInTheDocument();
    expect(screen.getByText("샘플 지출")).toBeInTheDocument();
    expect(screen.getByText("탐지 알림")).toBeInTheDocument();
    expect(screen.getByText("번들 CSV")).toBeInTheDocument();
    expect(screen.getByText("구독 후보 1")).toBeInTheDocument();
  });

  it("settles on the final counted values when motion is reduced", () => {
    render(
      <SampleDemoStats
        anomalyCount={10}
        subscriptionLeakCount={1}
        totalSpend="1797550.00"
        transactionCount={30}
      />,
    );

    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("₩1,797,550.00")).toBeInTheDocument();
  });
});
