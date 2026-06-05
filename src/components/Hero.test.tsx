import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hero } from "./Hero";

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

function renderHero() {
  return render(
    <Hero
      aiInsight={{
        amount: "₩780,000.00",
        amountValue: 780000,
        caption: "전자제품 매장 · 평소보다 큰 지출",
        label: "AI가 찾은 것",
        lines: ["반복 결제 후보를 먼저 확인하세요."],
      }}
      brandName="finsight"
      ctaHref="/login"
      ctaLabel="Google로 시작"
      description="CSV 명세서를 올리면 지출 구조와 이상 거래를 먼저 정리하고, AI가 절약 인사이트를 덧붙입니다."
      eyebrow="AI 지출 분석"
      headline="명세서에서 지출의 구조를 읽습니다"
      trend={[20, 60, 100]}
      demoSlot={{
        description: "다음 step에서 샘플 명세서 흐름을 연결합니다.",
        label: "샘플 데모",
        title: "샘플 명세서 데모 영역",
      }}
    />,
  );
}

describe("Hero", () => {
  beforeEach(() => {
    stubReducedMotion();
    stubIntersectingObserver();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a dark AI hero band with headline, single CTA, and demo slot", () => {
    renderHero();

    expect(screen.getByRole("banner")).toHaveClass("ai-surface-dark");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "명세서에서 지출의 구조를 읽습니다",
    );
    expect(screen.getByRole("link", { name: "Google로 시작" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("샘플 명세서 데모 영역")).toBeInTheDocument();
  });

  it("highlights the AI insight result card with label and mono headline number", () => {
    renderHero();

    expect(screen.getByText("AI가 찾은 것")).toBeInTheDocument();
    expect(
      screen.getByText("전자제품 매장 · 평소보다 큰 지출"),
    ).toBeInTheDocument();
    expect(screen.getByText("반복 결제 후보를 먼저 확인하세요.")).toBeInTheDocument();
    const amount = screen.getByText("₩780,000.00");
    expect(amount).toHaveClass("num");
  });
});
