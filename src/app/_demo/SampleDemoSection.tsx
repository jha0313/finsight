import { FileSpreadsheet, Siren, WalletCards } from "lucide-react";

import { DashboardResults } from "@/components/DashboardResults";
import { StatCard } from "@/components/StatCard";
import { formatMoney } from "@/lib/format";
import { sumMoney } from "@/lib/money";

import type { SampleDemoAnalysis } from "./sample-demo";

const iconProps = {
  "aria-hidden": "true",
  size: 20,
  strokeWidth: 2,
} as const;

export function SampleDemoSection({
  analysis,
}: {
  analysis: SampleDemoAnalysis;
}) {
  const { response, transactions } = analysis;
  const totalSpend = sumMoney(response.free.trend.map((point) => point.total));
  const subscriptionLeakCount = response.free.anomalies.filter(
    (anomaly) => anomaly.kind === "subscription_leak",
  ).length;

  return (
    <section aria-label="샘플 명세서 데모" className="mt-xxl">
      <div className="grid gap-xl lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end">
        <div>
          <p className="caption-strong">샘플 명세서</p>
          <h3 className="title-lg mt-sm">
            가입 전에 분석 결과를 먼저 확인합니다
          </h3>
          <p className="body-md mt-sm">
            카테고리, 기간 추이, 반복 결제 후보, AI 요약이 한 번에
            정리됩니다.
          </p>
        </div>

        <div className="grid gap-base sm:grid-cols-3">
          <StatCard
            detail="번들 CSV"
            icon={<FileSpreadsheet {...iconProps} />}
            label="거래 수"
            value={`${transactions.length}`}
          />
          <StatCard
            detail="3개월 합계"
            icon={<WalletCards {...iconProps} />}
            label="샘플 지출"
            value={formatMoney(totalSpend)}
          />
          <StatCard
            detail={`구독 후보 ${subscriptionLeakCount}`}
            icon={<Siren {...iconProps} />}
            label="탐지 알림"
            value={`${response.free.anomalies.length}`}
          />
        </div>
      </div>

      <div className="mt-xl">
        <DashboardResults response={response} />
      </div>
    </section>
  );
}
