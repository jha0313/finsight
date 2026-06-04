import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Anomaly } from "@/types/analysis";

import { AnomalyList } from "./AnomalyList";

const anomalies: Anomaly[] = [
  {
    kind: "subscription_leak",
    merchant: "Netflix",
    detail: "월간 반복 결제 후보: 3회, 최근 2026-06-01.",
  },
];

describe("AnomalyList", () => {
  it("renders anomaly kind, merchant, and detail from props", () => {
    render(<AnomalyList anomalies={anomalies} />);

    expect(screen.getByText("구독 누수")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(
      screen.getByText("월간 반복 결제 후보: 3회, 최근 2026-06-01."),
    ).toBeInTheDocument();
  });
});
