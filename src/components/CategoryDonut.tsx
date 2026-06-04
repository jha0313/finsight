import {
  formatCategory,
  formatMoney,
  formatPercent,
} from "@/lib/format";
import { sumMoney } from "@/lib/money";
import type { CategoryBreakdown } from "@/types/analysis";

export interface CategoryDonutProps {
  data: CategoryBreakdown[];
  currency?: string;
}

const DONUT_COLORS = [
  "var(--primary)",
  "var(--ink)",
  "var(--body)",
  "var(--muted)",
  "var(--hairline)",
  "var(--surface-strong)",
];

export function CategoryDonut({ data, currency }: CategoryDonutProps) {
  const total = sumMoney(data.map((item) => item.total));
  const totalNumber = Number(total);
  const segments = buildDonutSegments(data, totalNumber);

  return (
    <article className="rounded-card border border-hairline bg-canvas p-xl">
      <div className="flex items-start justify-between gap-base">
        <div>
          <h2 className="title-md">카테고리별 지출</h2>
          <p className="body-sm mt-xs">명세서의 지출 구성을 요약합니다.</p>
        </div>
        <p className="num text-ink">{formatMoney(total, currency)}</p>
      </div>

      <div className="mt-xl grid gap-xl md:grid-cols-[180px_1fr]">
        <div className="relative mx-auto size-[180px]">
          <svg
            aria-label="카테고리별 지출"
            className="size-full"
            role="img"
            viewBox="0 0 120 120"
          >
            <circle
              cx="60"
              cy="60"
              fill="none"
              r="46"
              stroke="var(--hairline-soft)"
              strokeWidth="14"
            />
            {segments.map((segment) => (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={segment.category}
                pathLength="100"
                r="46"
                stroke={segment.color}
                strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
                strokeDashoffset={-segment.offset}
                strokeLinecap="round"
                strokeWidth="14"
                transform="rotate(-90 60 60)"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="caption">총 지출</span>
            <span className="num text-ink">{formatMoney(total, currency)}</span>
          </div>
        </div>

        <div className="space-y-base">
          {data.length === 0 ? (
            <p className="body-sm rounded-field bg-surface-soft p-base">
              표시할 카테고리 데이터가 없습니다.
            </p>
          ) : (
            data.map((item, index) => (
              <div
                className="grid grid-cols-[auto_1fr_auto] items-center gap-base"
                key={item.category}
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-circle"
                  style={{
                    backgroundColor:
                      DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                />
                <div>
                  <p className="title-sm">{formatCategory(item.category)}</p>
                  <p className="caption">
                    <span className="num">{item.count}</span>건
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-ink">
                    {formatMoney(item.total, currency)}
                  </p>
                  <p className="num text-muted">
                    {formatPercent(item.total, total)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </article>
  );
}

function buildDonutSegments(
  data: CategoryBreakdown[],
  totalNumber: number,
): Array<{
  category: string;
  color: string;
  offset: number;
  percent: number;
}> {
  if (totalNumber <= 0) {
    return [];
  }

  let offset = 0;

  return data.map((item, index) => {
    const percent = (Number(item.total) / totalNumber) * 100;
    const segment = {
      category: item.category,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      offset,
      percent,
    };

    offset += percent;

    return segment;
  });
}
