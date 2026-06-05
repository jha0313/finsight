import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InsightTab } from "@/lib/landing-insights";

import { AiInsightShowcase } from "./AiInsightShowcase";

const tabs: InsightTab[] = [
  {
    key: "subscription-leak",
    label: "구독 누수",
    headlineNumber: "₩14,900.00",
    caption: "YouTube Premium · 반복 결제",
    insight: "매달 반복되는 구독 결제가 새고 있습니다.",
  },
  {
    key: "anomaly",
    label: "이상 거래",
    headlineNumber: "₩780,000.00",
    caption: "전자제품 매장 · 평소보다 큰 지출",
    insight: "평소보다 큰 단일 지출이 발견되었습니다.",
  },
  {
    key: "category-top",
    label: "카테고리 톱",
    headlineNumber: "₩780,000.00",
    caption: "기타 · 1건",
    insight: "기타 지출이 가장 큰 비중을 차지합니다.",
  },
];

const csvPreview: string[][] = [
  ["date", "merchant", "card", "amount"],
  ["2026-04-07", "YouTube Premium", "****-****-****-3456", "₩14,900"],
  ["2026-04-09", "전자제품 매장", "****-****-****-3456", "₩780,000"],
];

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
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

// useInView가 즉시 inView=true가 되도록 IntersectionObserver를 모킹.
function stubIntersectionObserver(immediate = true) {
  class FakeIO {
    cb: (entries: Array<{ isIntersecting: boolean }>) => void;
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      this.cb = cb;
    }
    observe = () => {
      if (immediate) {
        this.cb([{ isIntersecting: true }]);
      }
    };
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = () => [];
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal(
    "IntersectionObserver",
    FakeIO as unknown as typeof IntersectionObserver,
  );
}

const baseProps = {
  tabs,
  csvPreview,
  eyebrow: "AI 인사이트",
  title: "CSV가 인사이트가 되기까지",
  description: "AI가 명세서를 읽고 핵심만 정리합니다.",
};

describe("AiInsightShowcase", () => {
  beforeEach(() => {
    stubMatchMedia(false);
    stubIntersectionObserver(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders eyebrow, title and the first tab content by default", () => {
    render(<AiInsightShowcase {...baseProps} />);

    expect(screen.getByText("CSV가 인사이트가 되기까지")).toBeInTheDocument();
    expect(
      screen.getByText("매달 반복되는 구독 결제가 새고 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("₩14,900.00")).toBeInTheDocument();

    const firstTab = screen.getByRole("tab", { name: "구독 누수" });
    expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders the masked CSV preview cells", () => {
    render(<AiInsightShowcase {...baseProps} />);

    expect(screen.getAllByText("****-****-****-3456").length).toBeGreaterThan(0);
  });

  it("switches panel content when a different tab is clicked", () => {
    render(<AiInsightShowcase {...baseProps} />);

    fireEvent.click(screen.getByRole("tab", { name: "이상 거래" }));

    expect(
      screen.getByText("평소보다 큰 단일 지출이 발견되었습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("₩780,000.00")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "이상 거래" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "구독 누수" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("moves selection with the ArrowRight key", () => {
    render(<AiInsightShowcase {...baseProps} />);

    const firstTab = screen.getByRole("tab", { name: "구독 누수" });
    fireEvent.keyDown(firstTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "이상 거래" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("wraps to the first tab from the last with ArrowRight", () => {
    render(<AiInsightShowcase {...baseProps} />);

    fireEvent.click(screen.getByRole("tab", { name: "카테고리 톱" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "카테고리 톱" }), {
      key: "ArrowRight",
    });

    expect(screen.getByRole("tab", { name: "구독 누수" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("auto-cycles tabs over time and pauses on hover", () => {
    vi.useFakeTimers();
    render(<AiInsightShowcase {...baseProps} />);

    // first tab selected initially
    expect(screen.getByRole("tab", { name: "구독 누수" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("tab", { name: "이상 거래" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // hover pauses the carousel
    fireEvent.mouseEnter(screen.getByRole("region", { name: baseProps.title }));
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole("tab", { name: "이상 거래" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("does not auto-cycle when prefers-reduced-motion is set", () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    render(<AiInsightShowcase {...baseProps} />);

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole("tab", { name: "구독 누수" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
