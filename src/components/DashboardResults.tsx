import { AnomalyList } from "@/components/AnomalyList";
import { CategoryDonut } from "@/components/CategoryDonut";
import { InsightsPanel } from "@/components/InsightsPanel";
import { TrendLine } from "@/components/TrendLine";
import type { AnalyzeResponse } from "@/types/analysis";

export interface DashboardResultsProps {
  response: AnalyzeResponse;
}

export function DashboardResults({ response }: DashboardResultsProps) {
  return (
    <section aria-label="분석 결과" className="space-y-lg">
      <div className="grid gap-lg xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <CategoryDonut data={response.free.byCategory} />
        <InsightsPanel
          insights={response.pro.insights}
          status={response.pro.status}
        />
      </div>

      <div className="grid gap-lg xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TrendLine data={response.free.trend} />
        <AnomalyList anomalies={response.free.anomalies} />
      </div>

      {response.warnings === undefined || response.warnings.length === 0 ? null : (
        <aside
          aria-label="분석 경고"
          className="rounded-card border border-hairline bg-surface-soft p-xl"
        >
          <h2 className="title-md">파싱 메모</h2>
          <ul className="mt-base space-y-sm">
            {response.warnings.map((warning) => (
              <li className="body-sm" key={warning}>
                {warning}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
