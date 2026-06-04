import type { ReactNode } from "react";
import { CircleAlert, Lock, Sparkles } from "lucide-react";

import type { ProInsights } from "@/types/analysis";
import type { ProStatus } from "@/types/tier";

export interface InsightsPanelProps {
  status: ProStatus;
  insights?: ProInsights;
}

export function InsightsPanel({ status, insights }: InsightsPanelProps) {
  if (status === "locked") {
    return (
      <InsightShell
        icon={<Lock aria-hidden="true" size={20} strokeWidth={2} />}
        title="Pro 분석 잠금"
      >
        <p className="body-sm">
          Free 분석 결과를 먼저 표시합니다. Pro 구독이 활성화되면 Opus
          심층 분석을 이어서 표시합니다.
        </p>
      </InsightShell>
    );
  }

  if (status === "unavailable" || insights === undefined) {
    return (
      <InsightShell
        icon={<CircleAlert aria-hidden="true" size={20} strokeWidth={2} />}
        title="AI 인사이트를 사용할 수 없습니다"
      >
        <p className="body-sm">
          규칙 기반 분석은 유지되며, AI 응답 실패는 별도로 격리됩니다.
        </p>
      </InsightShell>
    );
  }

  return (
    <InsightShell
      icon={<Sparkles aria-hidden="true" size={20} strokeWidth={2} />}
      title="AI 인사이트"
    >
      <p className="body-strong">{insights.summary}</p>
      <ul className="mt-base space-y-sm">
        {insights.insights.map((insight) => (
          <li className="body-sm flex gap-sm" key={insight}>
            <span
              aria-hidden="true"
              className="mt-[0.55em] size-1.5 rounded-circle bg-ink"
            />
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </InsightShell>
  );
}

function InsightShell({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-card border border-hairline bg-canvas p-xl">
      <div className="flex items-start gap-base">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-circle bg-surface-strong text-ink">
          {icon}
        </div>
        <div>
          <h2 className="title-md">{title}</h2>
          <div className="mt-sm">{children}</div>
        </div>
      </div>
    </article>
  );
}
