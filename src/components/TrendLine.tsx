import { formatDate, formatMoney } from "@/lib/format";
import type { TrendPoint } from "@/types/analysis";

export interface TrendLineProps {
  data: TrendPoint[];
  currency?: string;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const CHART_PADDING = 24;

export function TrendLine({ data, currency }: TrendLineProps) {
  const points = buildLinePoints(data);
  const path = pointsToPath(points);
  const latestPoint = data.at(-1);

  return (
    <article className="rounded-card border border-hairline bg-canvas p-xl">
      <div className="flex items-start justify-between gap-base">
        <div>
          <h2 className="title-md">기간별 지출 추이</h2>
          <p className="body-sm mt-xs">월별 지출 흐름을 비교합니다.</p>
        </div>
        {latestPoint === undefined ? null : (
          <div className="text-right">
            <p className="caption">최근 기간</p>
            <p className="num text-ink">
              {formatMoney(latestPoint.total, currency)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-xl">
        {data.length === 0 ? (
          <p className="body-sm rounded-field bg-surface-soft p-base">
            표시할 추이 데이터가 없습니다.
          </p>
        ) : (
          <svg
            aria-label="기간별 지출 추이"
            className="h-[180px] w-full"
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <line
              stroke="var(--hairline-soft)"
              strokeWidth="1"
              x1={CHART_PADDING}
              x2={CHART_WIDTH - CHART_PADDING}
              y1={CHART_HEIGHT - CHART_PADDING}
              y2={CHART_HEIGHT - CHART_PADDING}
            />
            <path
              d={path}
              fill="none"
              stroke="var(--primary)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {points.map((point) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill="var(--canvas)"
                key={point.period}
                r="4"
                stroke="var(--primary)"
                strokeWidth="2"
              />
            ))}
          </svg>
        )}
      </div>

      <div className="mt-lg grid gap-base md:grid-cols-2">
        {data.map((point) => (
          <div
            className="rounded-field border border-hairline-soft bg-surface-soft p-base"
            key={point.period}
          >
            <p className="num text-muted">{formatDate(point.period)}</p>
            <p className="num text-ink">{formatMoney(point.total, currency)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildLinePoints(data: TrendPoint[]): Array<{
  period: string;
  x: number;
  y: number;
}> {
  if (data.length === 0) {
    return [];
  }

  const values = data.map((point) => Math.max(0, Number(point.total)));
  const max = Math.max(...values, 1);
  const horizontalSpan = CHART_WIDTH - CHART_PADDING * 2;
  const verticalSpan = CHART_HEIGHT - CHART_PADDING * 2;

  return data.map((point, index) => {
    const x =
      data.length === 1
        ? CHART_WIDTH / 2
        : CHART_PADDING + (horizontalSpan * index) / (data.length - 1);
    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      (Math.max(0, Number(point.total)) / max) * verticalSpan;

    return {
      period: point.period,
      x,
      y,
    };
  });
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}
