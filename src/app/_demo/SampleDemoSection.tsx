import { DashboardResults } from "@/components/DashboardResults";
import { sumMoney } from "@/lib/money";

import { SampleDemoStats } from "./SampleDemoStats";
import type { SampleDemoAnalysis } from "./sample-demo";

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

        <SampleDemoStats
          anomalyCount={response.free.anomalies.length}
          subscriptionLeakCount={subscriptionLeakCount}
          totalSpend={totalSpend}
          transactionCount={transactions.length}
        />
      </div>

      <div className="mt-xl">
        <DashboardResults response={response} />
      </div>
    </section>
  );
}
