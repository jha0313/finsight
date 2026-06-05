import type { SampleDemoAnalysis } from "@/app/_demo/sample-demo";
import { formatCategory, formatMoney } from "@/lib/format";
import type { Anomaly, CategoryBreakdown } from "@/types/analysis";

export type InsightTab = {
  key: string;
  label: string;
  headlineNumber: string;
  caption: string;
  insight: string;
};

const MAX_TABS = 4;
// 마지막 4자리만 노출하고 앞 그룹은 모두 가린다(전체 PAN 미노출).
const CARD_CELL = /^[\d][\d\s-]{10,}\d$/;
// detail 문자열의 마지막 십진수 금액(예 "... 대표 금액 14900.00.")을 잡는다.
const TRAILING_AMOUNT = /(\d+(?:\.\d+)?)\s*\.?\s*$/;

/**
 * 데모 분석 결과에서 랜딩에 강조할 인사이트 탭 3~4개를 구성한다.
 * - 구독 누수: subscription_leak 이상거래
 * - 이상 거래: 가장 금액이 큰 outlier 이상거래
 * - 카테고리 톱: 지출 1위 카테고리
 * 숫자는 formatMoney로 포맷한 문자열이고, insight는 가능한 한 pro 인사이트를
 * 쓰되 없으면 규칙·통계 결과(detail/통계)에서 채워 비어있지 않게 한다.
 */
export function selectInsightTabs(analysis: SampleDemoAnalysis): InsightTab[] {
  const { free, pro } = analysis.response;
  const proInsights = pro.insights?.insights ?? [];
  const proSummary = pro.insights?.summary ?? "";

  const tabs: InsightTab[] = [];

  const subscription = free.anomalies.find(
    (anomaly) => anomaly.kind === "subscription_leak",
  );

  if (subscription !== undefined) {
    tabs.push({
      key: "subscription-leak",
      label: "구독 누수",
      headlineNumber: formatMoney(anomalyAmount(subscription)),
      caption: `${subscription.merchant} · 반복 결제`,
      insight: firstNonEmpty(proInsights[0], subscription.detail),
    });
  }

  const topOutlier = largestOutlier(free.anomalies);

  if (topOutlier !== undefined) {
    tabs.push({
      key: "anomaly",
      label: "이상 거래",
      headlineNumber: formatMoney(anomalyAmount(topOutlier)),
      caption: `${topOutlier.merchant} · 평소보다 큰 지출`,
      insight: firstNonEmpty(proInsights[1], topOutlier.detail),
    });
  }

  const topCategory = topCategoryBreakdown(free.byCategory);

  if (topCategory !== undefined) {
    tabs.push({
      key: "category-top",
      label: "카테고리 톱",
      headlineNumber: formatMoney(topCategory.total),
      caption: `${formatCategory(topCategory.category)} · ${topCategory.count}건`,
      insight: firstNonEmpty(
        proSummary,
        proInsights[2],
        `${formatCategory(topCategory.category)} 지출이 가장 큰 비중을 차지합니다.`,
      ),
    });
  }

  // 이상거래가 없는 명세서면 카테고리 상위 항목으로 탭 수를 채운다.
  for (const category of free.byCategory.slice(1)) {
    if (tabs.length >= 3) {
      break;
    }

    tabs.push(categoryTab(category));
  }

  return tabs.slice(0, MAX_TABS);
}

/**
 * CSV 원문에서 미리보기용 행(헤더 + 최대 n개 데이터행)을 만든다.
 * 카드/계좌번호 셀은 ****-****-****-마지막4 형태로 마스킹해 평문 PAN을
 * 미리보기에 노출하지 않는다.
 */
export function previewCsvRows(csv: string, n: number): string[][] {
  const lines = csv
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const limit = Math.max(0, n);
  const selected = [lines[0], ...lines.slice(1, 1 + limit)];

  return selected.map((line) => parseCsvLine(line).map(maskCell));
}

function categoryTab(category: CategoryBreakdown): InsightTab {
  return {
    key: `category-${category.category}`,
    label: formatCategory(category.category),
    headlineNumber: formatMoney(category.total),
    caption: `${formatCategory(category.category)} · ${category.count}건`,
    insight: `${formatCategory(category.category)} 지출이 ${category.count}건으로 집계되었습니다.`,
  };
}

function largestOutlier(anomalies: Anomaly[]): Anomaly | undefined {
  let largest: Anomaly | undefined;
  let largestAmount = -1;

  for (const anomaly of anomalies) {
    if (anomaly.kind !== "outlier") {
      continue;
    }

    const amount = Number(anomalyAmount(anomaly));

    if (amount > largestAmount) {
      largest = anomaly;
      largestAmount = amount;
    }
  }

  return largest;
}

function topCategoryBreakdown(
  byCategory: CategoryBreakdown[],
): CategoryBreakdown | undefined {
  return byCategory[0];
}

// detail 문자열에서 마지막 금액 토큰을 뽑는다. 못 찾으면 "0".
function anomalyAmount(anomaly: Anomaly): string {
  const match = TRAILING_AMOUNT.exec(anomaly.detail.trim());

  return match === null ? "0" : match[1];
}

function firstNonEmpty(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.trim() !== "") {
      return candidate;
    }
  }

  return "";
}

function maskCell(cell: string): string {
  const trimmed = cell.trim();

  if (!CARD_CELL.test(trimmed)) {
    return cell;
  }

  const digits = trimmed.replace(/\D/g, "");
  const last4 = digits.slice(-4);

  return `****-****-****-${last4}`;
}

// 따옴표로 감싼 셀 안의 콤마는 구분자로 보지 않는 최소 CSV 라인 파서.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);

  return cells;
}
