import { AlertTriangle } from "lucide-react";

import { formatMoney } from "@/lib/format";
import type { Anomaly, AnomalyKind, AnomalySeverity } from "@/types/analysis";

export interface AnomalyListProps {
  anomalies: Anomaly[];
  currency?: string;
}

const KIND_LABELS: Record<AnomalyKind, string> = {
  annual_cost: "연 환산",
  price_hike: "가격 인상",
  duplicate_subscription: "중복 구독",
  dormant_subscription: "휴면 구독",
  double_charge: "이중 청구",
  category_outlier: "카테고리 이상",
  new_high_merchant: "신규 고액",
  category_surge: "카테고리 급증",
};

export function AnomalyList({ anomalies, currency }: AnomalyListProps) {
  return (
    <article className="rounded-card border border-hairline bg-canvas p-xl">
      <div>
        <h2 className="title-md">이상 거래와 구독 누수</h2>
        <p className="body-sm mt-xs">
          반복 결제와 평소보다 큰 지출을 따로 표시합니다.
        </p>
      </div>

      <div className="mt-xl space-y-base">
        {anomalies.length === 0 ? (
          <p className="body-sm rounded-field bg-surface-soft p-base">
            감지된 이상 거래가 없습니다.
          </p>
        ) : (
          anomalies.map((anomaly, index) => (
            <div
              className="grid grid-cols-[44px_1fr] gap-base rounded-card border border-hairline-soft bg-surface-soft p-base"
              key={`${anomaly.kind}-${anomaly.merchant}-${index}`}
            >
              <div
                className={`flex size-11 items-center justify-center rounded-circle bg-canvas ${iconColorClass(
                  anomaly.severity,
                )}`}
              >
                <AlertTriangle aria-hidden="true" size={20} strokeWidth={2} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-sm">
                  <p
                    className={`caption-strong ${labelColorClass(
                      anomaly.severity,
                    )}`}
                  >
                    {KIND_LABELS[anomaly.kind]}
                  </p>
                  <p className="title-sm">{anomaly.merchant}</p>
                </div>
                <p className="body-sm mt-xs">{anomaly.detail}</p>
                {anomaly.amount === undefined ? null : (
                  <div className="mt-sm flex items-baseline gap-sm">
                    {anomaly.amountLabel === undefined ? null : (
                      <span className="caption text-muted">
                        {anomaly.amountLabel}
                      </span>
                    )}
                    <span className="num">
                      {formatAmount(anomaly.amount, currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function formatAmount(amount: string, currency?: string): string {
  return currency === undefined ? amount : formatMoney(amount, currency);
}

function iconColorClass(severity: AnomalySeverity): string {
  if (severity === "high") {
    return "text-semantic-down";
  }

  if (severity === "warn") {
    return "text-ink";
  }

  return "text-muted";
}

function labelColorClass(severity: AnomalySeverity): string {
  if (severity === "high") {
    return "text-semantic-down";
  }

  if (severity === "warn") {
    return "text-ink";
  }

  return "text-muted";
}
