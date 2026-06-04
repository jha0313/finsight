import { AlertTriangle } from "lucide-react";

import type { Anomaly } from "@/types/analysis";

export interface AnomalyListProps {
  anomalies: Anomaly[];
}

export function AnomalyList({ anomalies }: AnomalyListProps) {
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
              <div className="flex size-11 items-center justify-center rounded-circle bg-canvas text-semantic-down">
                <AlertTriangle aria-hidden="true" size={20} strokeWidth={2} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-sm">
                  <p className="caption-strong text-semantic-down">
                    {formatAnomalyKind(anomaly.kind)}
                  </p>
                  <p className="title-sm">{anomaly.merchant}</p>
                </div>
                <p className="body-sm mt-xs">{anomaly.detail}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function formatAnomalyKind(kind: Anomaly["kind"]): string {
  if (kind === "subscription_leak") {
    return "구독 누수";
  }

  if (kind === "outlier") {
    return "이상 거래";
  }

  return "알림";
}
