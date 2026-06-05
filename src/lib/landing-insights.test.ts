import { describe, expect, it } from "vitest";

import type { SampleDemoAnalysis } from "@/app/_demo/sample-demo";

import { previewCsvRows, selectInsightTabs } from "./landing-insights";

// 실제 데모(getSampleDemoAnalysis)의 response 구조를 그대로 본떠 테스트한다.
// selectInsightTabs는 analysis.response.free.{byCategory,anomalies}와
// analysis.response.pro.insights만 읽으므로 그 부분만 채운다.
function buildAnalysis(
  overrides: Partial<SampleDemoAnalysis["response"]> = {},
): SampleDemoAnalysis {
  const response: SampleDemoAnalysis["response"] = {
    tier: "free",
    free: {
      byCategory: [
        { category: "other", total: "780000.00", count: 1 },
        { category: "shopping", total: "379500.00", count: 5 },
        { category: "utilities", total: "324000.00", count: 3 },
      ],
      trend: [],
      anomalies: [
        {
          kind: "duplicate_subscription",
          severity: "warn",
          merchant: "YouTube Premium",
          detail: "월간 반복 결제 후보: 3회, 최근 2026-06-07, 대표 금액 14900.00.",
        },
        {
          kind: "category_outlier",
          severity: "high",
          merchant: "전자제품 매장",
          detail: "평소 지출 중앙값 14900.00 대비 큰 금액 780000.00.",
        },
        {
          kind: "category_outlier",
          severity: "warn",
          merchant: "쿠팡 로켓배송",
          detail: "평소 지출 중앙값 14900.00 대비 큰 금액 124000.00.",
        },
      ],
    },
    pro: {
      status: "locked",
      insights: {
        summary: "6월 전자제품 지출과 월간 반복 결제가 지출 변동의 핵심입니다.",
        insights: [
          "반복 결제 후보를 먼저 확인하고 필요 없는 구독을 점검합니다.",
          "6월의 큰 단일 거래는 월별 추이를 왜곡하므로 별도 지출로 분리해 보는 편이 낫습니다.",
          "환불 거래는 지출 합계에서 제외되어 실제 소비 흐름만 비교됩니다.",
        ],
      },
    },
    ...overrides,
  };

  return {
    response,
    transactions: [],
    sourceHash: "test-hash",
    needsFallback: false,
  } as SampleDemoAnalysis;
}

const sampleCsv = `날짜,가맹점,금액,통화,카드번호
2026-04-07,YouTube Premium,"₩14,900",KRW,1234-5678-9012-3456
2026-04-08,스타벅스 강남점,"₩5,800",KRW,1234-5678-9012-3456
2026-04-09,지하철 2호선,"₩1,550",KRW,1234-5678-9012-3456`;

describe("selectInsightTabs", () => {
  it("builds 3 to 4 tabs from demo free + pro data", () => {
    const tabs = selectInsightTabs(buildAnalysis());

    expect(tabs.length).toBeGreaterThanOrEqual(3);
    expect(tabs.length).toBeLessThanOrEqual(4);
  });

  it("gives every tab a key, label, headlineNumber, caption, and non-empty insight", () => {
    const tabs = selectInsightTabs(buildAnalysis());

    const keys = new Set<string>();

    for (const tab of tabs) {
      expect(tab.key).not.toBe("");
      expect(tab.label).not.toBe("");
      expect(tab.caption).not.toBe("");
      expect(tab.insight.trim()).not.toBe("");
      keys.add(tab.key);
    }

    // 키는 고유해야 React 리스트 key로 안전하다.
    expect(keys.size).toBe(tabs.length);
  });

  it("formats every headlineNumber as a currency string via formatMoney", () => {
    const tabs = selectInsightTabs(buildAnalysis());

    for (const tab of tabs) {
      // KRW 데모 금액은 ₩ 기호 + 천단위 콤마 + 두 자리 소수로 포맷된다.
      expect(tab.headlineNumber).toMatch(/^₩[\d,]+\.\d{2}$/);
    }
  });

  it("includes a subscription-leak tab and an anomaly tab from the demo anomalies", () => {
    const tabs = selectInsightTabs(buildAnalysis());
    const labels = tabs.map((tab) => tab.label);

    expect(labels).toContain("구독 누수");
    expect(labels).toContain("이상 거래");
  });

  it("uses the largest outlier amount for the anomaly tab headline", () => {
    const tabs = selectInsightTabs(buildAnalysis());
    const anomalyTab = tabs.find((tab) => tab.label === "이상 거래");

    expect(anomalyTab).toBeDefined();
    // 최대 outlier(전자제품 매장 780000)가 헤드라인이 되어야 한다.
    expect(anomalyTab?.headlineNumber).toBe("₩780,000.00");
    expect(anomalyTab?.caption).toContain("전자제품 매장");
  });

  it("uses the top category total for the category tab headline", () => {
    const tabs = selectInsightTabs(buildAnalysis());
    const categoryTab = tabs.find((tab) => tab.key === "category-top");

    expect(categoryTab).toBeDefined();
    expect(categoryTab?.headlineNumber).toBe("₩780,000.00");
    // 한국어 카테고리 라벨이 캡션에 들어간다.
    expect(categoryTab?.caption).toContain("기타");
  });

  it("falls back to anomaly detail for insight text when pro insights are absent", () => {
    const tabs = selectInsightTabs(
      buildAnalysis({
        pro: { status: "unavailable" },
      }),
    );

    // pro 인사이트가 없어도 각 탭의 insight는 비어있지 않아야 한다.
    for (const tab of tabs) {
      expect(tab.insight.trim()).not.toBe("");
    }
  });

  it("still returns tabs when there are no anomalies, using categories", () => {
    const tabs = selectInsightTabs(
      buildAnalysis({
        free: {
          byCategory: [
            { category: "shopping", total: "379500.00", count: 5 },
            { category: "food", total: "55300.00", count: 6 },
            { category: "transport", total: "23050.00", count: 4 },
          ],
          trend: [],
          anomalies: [],
        },
        pro: { status: "unavailable" },
      }),
    );

    expect(tabs.length).toBeGreaterThanOrEqual(3);

    for (const tab of tabs) {
      expect(tab.headlineNumber).toMatch(/^₩[\d,]+\.\d{2}$/);
      expect(tab.insight.trim()).not.toBe("");
    }
  });
});

describe("previewCsvRows", () => {
  it("returns the header row plus up to n data rows", () => {
    const rows = previewCsvRows(sampleCsv, 2);

    // 헤더 1행 + 데이터 2행.
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(["날짜", "가맹점", "금액", "통화", "카드번호"]);
  });

  it("never returns more than n data rows even when more exist", () => {
    const rows = previewCsvRows(sampleCsv, 1);

    expect(rows.length).toBe(2);
  });

  it("returns all available data rows when n exceeds the count", () => {
    const rows = previewCsvRows(sampleCsv, 99);

    // 헤더 1 + 데이터 3.
    expect(rows.length).toBe(4);
  });

  it("parses quoted cells that contain commas without splitting them", () => {
    const rows = previewCsvRows(sampleCsv, 1);

    // "₩14,900" 은 콤마가 있어도 하나의 셀로 유지되어야 한다.
    expect(rows[1][2]).toBe("₩14,900");
  });

  it("masks card-number cells to ****-****-****-last4 form", () => {
    const rows = previewCsvRows(sampleCsv, 1);
    const cardCell = rows[1][4];

    expect(cardCell).toBe("****-****-****-3456");
    // 평문 PAN 앞자리는 미리보기에 노출되지 않는다.
    expect(cardCell).not.toContain("1234");
  });

  it("does not mask non-identifier cells", () => {
    const rows = previewCsvRows(sampleCsv, 1);

    expect(rows[1][0]).toBe("2026-04-07");
    expect(rows[1][1]).toBe("YouTube Premium");
  });
});
