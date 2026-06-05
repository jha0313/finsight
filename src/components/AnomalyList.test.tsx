import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Anomaly } from "@/types/analysis";

import { AnomalyList } from "./AnomalyList";

const anomalies: Anomaly[] = [
  {
    kind: "duplicate_subscription",
    severity: "high",
    merchant: "엔터테인먼트 구독 3개",
    detail: "동일 카테고리에서 3개의 구독이 동시에 결제되고 있어요.",
    amount: "51000.00",
    amountLabel: "월 합계",
  },
];

describe("AnomalyList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Korean kind label, merchant, and detail from props", () => {
    render(<AnomalyList anomalies={anomalies} />);

    expect(screen.getByText("중복 구독")).toBeInTheDocument();
    expect(screen.getByText("엔터테인먼트 구독 3개")).toBeInTheDocument();
    expect(
      screen.getByText(
        "동일 카테고리에서 3개의 구독이 동시에 결제되고 있어요.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the amount label and currency-formatted amount", () => {
    render(<AnomalyList anomalies={anomalies} currency="KRW" />);

    expect(screen.getByText("월 합계")).toBeInTheDocument();
    expect(screen.getByText("₩51,000.00")).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no anomalies", () => {
    render(<AnomalyList anomalies={[]} />);

    expect(
      screen.getByText("감지된 이상 거래가 없습니다."),
    ).toBeInTheDocument();
  });
});
