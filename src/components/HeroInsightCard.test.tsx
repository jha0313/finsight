import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroInsightCard } from "./HeroInsightCard";

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

function stubIntersectingObserver() {
  class StubObserver {
    constructor(private callback: IntersectionObserverCallback) {}
    observe = (el: Element) => {
      this.callback(
        [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    };
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", StubObserver);
}

const insight = {
  amount: "₩780,000.00",
  amountValue: 780000,
  caption: "전자제품 매장 · 평소보다 큰 지출",
  label: "AI가 찾은 것",
  lines: ["반복 결제 후보를 먼저 확인하세요.", "큰 단일 거래를 분리해 보세요."],
};

describe("HeroInsightCard", () => {
  beforeEach(() => {
    stubReducedMotion();
    stubIntersectingObserver();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the AI label and the counted-up headline amount", () => {
    render(<HeroInsightCard insight={insight} trend={[20, 60, 100]} />);

    expect(screen.getByText("AI가 찾은 것")).toBeInTheDocument();
    // reduced-motion + in view -> count-up settles immediately to target
    const amount = screen.getByText("₩780,000.00");
    expect(amount).toHaveClass("num");
  });

  it("renders the caption and every insight line", () => {
    render(<HeroInsightCard insight={insight} />);

    expect(
      screen.getByText("전자제품 매장 · 평소보다 큰 지출"),
    ).toBeInTheDocument();
    for (const line of insight.lines) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("exposes the in-view state on the card for motion binding", () => {
    const { container } = render(<HeroInsightCard insight={insight} />);
    const card = container.querySelector("article");
    expect(card).toHaveAttribute("data-inview", "true");
  });
});
