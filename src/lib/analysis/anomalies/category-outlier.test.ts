import { describe, expect, it } from "vitest";

import type { Transaction } from "@/types/transaction";

import { detectCategoryOutliers } from "./category-outlier";

function transaction(
  overrides: Partial<Transaction> & {
    date: string;
    merchant: string;
    signedAmount: string;
  },
): Transaction {
  return {
    date: overrides.date,
    merchant: overrides.merchant,
    signedAmount: overrides.signedAmount,
    direction: overrides.direction ?? "debit",
    category: overrides.category ?? "other",
    currency: overrides.currency ?? "KRW",
    maskedAccount: overrides.maskedAccount,
    rowHash:
      overrides.rowHash ??
      `${overrides.date}-${overrides.merchant}-${overrides.signedAmount}`,
  };
}

// 평소 5천원 카페에서 5만원이 찍힌, "같은 카테고리 평소 대비" 큰 거래 4건+1 outlier.
function cafeBaseline(): Transaction[] {
  return [
    transaction({
      date: "2026-01-03",
      merchant: "스타벅스",
      signedAmount: "5000.00",
      category: "food",
    }),
    transaction({
      date: "2026-01-10",
      merchant: "투썸",
      signedAmount: "5000.00",
      category: "food",
    }),
    transaction({
      date: "2026-01-17",
      merchant: "이디야",
      signedAmount: "5000.00",
      category: "food",
    }),
    transaction({
      date: "2026-01-24",
      merchant: "메가커피",
      signedAmount: "5000.00",
      category: "food",
    }),
  ];
}

describe("detectCategoryOutliers", () => {
  it("returns no anomalies for empty input", () => {
    expect(detectCategoryOutliers([])).toEqual([]);
  });

  it("flags a transaction that exceeds 3x the category median", () => {
    const outliers = detectCategoryOutliers([
      ...cafeBaseline(),
      transaction({
        date: "2026-01-30",
        merchant: "호텔뷔페",
        signedAmount: "50000.00",
        category: "food",
      }),
    ]);

    expect(outliers).toHaveLength(1);
    expect(outliers[0]).toEqual({
      kind: "category_outlier",
      severity: "warn",
      merchant: "호텔뷔페",
      detail: "식비 평소 5000.00 대비 큰 50000.00",
      amount: "50000.00",
      amountLabel: "이상 금액",
    });
  });

  it("compares within the category, not the global pool", () => {
    // shopping 한 건이 식비 median 대비로는 크지만, shopping 카테고리는
    // 4건 미만이라 자체 비교 대상이 아니고, 식비 풀과 섞이지도 않는다.
    const outliers = detectCategoryOutliers([
      ...cafeBaseline(),
      transaction({
        date: "2026-01-28",
        merchant: "백화점",
        signedAmount: "300000.00",
        category: "shopping",
      }),
    ]);

    expect(outliers).toEqual([]);
  });

  it("skips categories with fewer than 4 transactions", () => {
    const outliers = detectCategoryOutliers([
      transaction({
        date: "2026-01-03",
        merchant: "카페",
        signedAmount: "5000.00",
        category: "food",
      }),
      transaction({
        date: "2026-01-10",
        merchant: "카페",
        signedAmount: "5000.00",
        category: "food",
      }),
      transaction({
        date: "2026-01-17",
        merchant: "호텔",
        signedAmount: "50000.00",
        category: "food",
      }),
    ]);

    expect(outliers).toEqual([]);
  });

  it("treats the threshold as strictly greater than median*3 (boundary)", () => {
    // median 5000.00 → threshold 15000.00. 정확히 15000.00은 제외, 15000.01은 포함.
    const atThreshold = detectCategoryOutliers([
      ...cafeBaseline(),
      transaction({
        date: "2026-01-30",
        merchant: "경계",
        signedAmount: "15000.00",
        category: "food",
      }),
    ]);
    expect(atThreshold).toEqual([]);

    const justOver = detectCategoryOutliers([
      ...cafeBaseline(),
      transaction({
        date: "2026-01-30",
        merchant: "경계초과",
        signedAmount: "15000.01",
        category: "food",
      }),
    ]);
    expect(justOver).toHaveLength(1);
    expect(justOver[0].merchant).toBe("경계초과");
  });

  it("sorts by amount desc, then date asc, then merchant asc", () => {
    // food median 5000 → threshold 15000. transport median도 5000 → threshold 15000.
    const outliers = detectCategoryOutliers([
      ...cafeBaseline(),
      // food outliers
      transaction({
        date: "2026-02-05",
        merchant: "B가맹",
        signedAmount: "20000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-01",
        merchant: "A가맹",
        signedAmount: "20000.00",
        category: "food",
      }),
      transaction({
        date: "2026-02-10",
        merchant: "C가맹",
        signedAmount: "90000.00",
        category: "food",
      }),
      // transport baseline (4건) + 1 outlier로 같은 금액(20000) 동점 유발
      transaction({
        date: "2026-03-01",
        merchant: "버스1",
        signedAmount: "5000.00",
        category: "transport",
      }),
      transaction({
        date: "2026-03-02",
        merchant: "버스2",
        signedAmount: "5000.00",
        category: "transport",
      }),
      transaction({
        date: "2026-03-03",
        merchant: "버스3",
        signedAmount: "5000.00",
        category: "transport",
      }),
      transaction({
        date: "2026-03-04",
        merchant: "버스4",
        signedAmount: "5000.00",
        category: "transport",
      }),
      // 같은 금액 20000.00, 같은 date 2026-02-05 동점 → merchant asc 확인
      transaction({
        date: "2026-02-05",
        merchant: "택시",
        signedAmount: "20000.00",
        category: "transport",
      }),
    ]);

    expect(outliers.map((anomaly) => anomaly.merchant)).toEqual([
      "C가맹", // 90000
      "A가맹", // 20000, date 02-01 (가장 이른 날짜)
      "B가맹", // 20000, date 02-05, merchant "B가맹"
      "택시", // 20000, date 02-05, merchant "택시" (B가맹 < 택시)
    ]);
  });
});
