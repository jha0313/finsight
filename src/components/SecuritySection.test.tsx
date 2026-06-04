import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SecuritySection } from "./SecuritySection";

describe("SecuritySection", () => {
  it("renders the soft-gray security band with privacy guarantees", () => {
    render(
      <SecuritySection
        description="분석에 필요한 정보만 남기고 직접 식별자는 경계 밖으로 내보내지 않습니다."
        eyebrow="신뢰와 보안"
        items={[
          {
            description: "카드·계좌번호는 적재 시 마스킹하고 전체 PAN은 저장하지 않습니다.",
            title: "식별자 마스킹",
          },
          {
            description: "RLS로 사용자별 명세서 접근을 DB 레벨에서 격리합니다.",
            title: "사용자별 격리",
          },
          {
            description: "Claude에는 마스킹된 거래 단위만 전달합니다.",
            title: "마스킹 전송",
          },
        ]}
        title="분석보다 먼저 지키는 경계"
      />,
    );

    expect(screen.getByLabelText("신뢰와 보안")).toHaveClass("bg-surface-soft");
    expect(screen.getByText(/전체 PAN은 저장하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText("사용자별 격리")).toBeInTheDocument();
    expect(screen.getByText("마스킹 전송")).toBeInTheDocument();
  });
});
