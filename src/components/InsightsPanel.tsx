import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  LoaderCircle,
  Lock,
  Sparkles,
} from "lucide-react";

import type { ProInsights } from "@/types/analysis";
import type { ProStatus } from "@/types/tier";

export interface InsightsPanelProps {
  status: ProStatus;
  insights?: ProInsights;
  // 서버 구독은 Pro로 확정됐고 Opus 심층 분석을 생성 중인 상태. status보다
  // 우선해 잠금 CTA 대신 진행 표시를 보여준다(이미 Pro인데 업그레이드 버튼이
  // 뜨는 혼란 방지).
  pending?: boolean;
}

const checkoutAction = "/api/checkout";

export function InsightsPanel({
  status,
  insights,
  pending = false,
}: InsightsPanelProps) {
  if (pending) {
    return (
      <InsightShell
        accent
        icon={<Sparkles aria-hidden="true" size={20} strokeWidth={2} />}
        title="AI 인사이트"
      >
        <p className="body-sm flex items-center gap-sm" role="status">
          <LoaderCircle
            aria-hidden="true"
            className="animate-spin"
            size={18}
            strokeWidth={2}
          />
          Pro 심층 분석(Opus)을 생성하는 중입니다. 잠시만 기다려 주세요.
        </p>
      </InsightShell>
    );
  }

  if (status === "unavailable") {
    return (
      <InsightShell
        icon={<CircleAlert aria-hidden="true" size={20} strokeWidth={2} />}
        title="AI 인사이트를 사용할 수 없습니다"
      >
        <p className="body-sm">
          지금은 Pro 분석을 시작할 수 없습니다. 규칙 기반 분석은 그대로
          유지됩니다.
        </p>
      </InsightShell>
    );
  }

  if (status === "active") {
    return (
      <InsightShell
        accent
        icon={<Sparkles aria-hidden="true" size={20} strokeWidth={2} />}
        title="AI 인사이트"
      >
        {insights !== undefined ? <InsightBody insights={insights} /> : null}
      </InsightShell>
    );
  }

  // status === "locked"(미구독): 인사이트(Free=Sonnet)가 있으면 함께 보여주되,
  // 인사이트 유무와 관계없이 항상 업그레이드 CTA를 노출한다.
  return (
    <InsightShell
      icon={<Lock aria-hidden="true" size={20} strokeWidth={2} />}
      title="Pro 분석 잠금"
    >
      {insights !== undefined ? (
        <InsightBody insights={insights} />
      ) : (
        <p className="body-sm">
          Free 분석 결과를 먼저 표시합니다. Pro 구독이 활성화되면 Opus 심층
          분석을 이어서 표시합니다.
        </p>
      )}
      <UpgradeCta action={checkoutAction} />
    </InsightShell>
  );
}

function InsightBody({ insights }: { insights: ProInsights }) {
  return (
    <>
      <p className="body-strong">{insights.summary}</p>
      <ul className="mt-base space-y-sm">
        {insights.insights.map((insight) => (
          <li className="body-sm flex gap-sm" key={insight}>
            <span
              aria-hidden="true"
              className="mt-[0.55em] size-1.5 rounded-circle bg-ai-violet"
            />
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function UpgradeCta({ action }: { action: string }) {
  return (
    <div className="mt-base flex flex-col gap-sm sm:flex-row sm:items-center">
      <form action={action} method="post">
        <button
          className="btn-label inline-flex min-h-11 items-center justify-center gap-xs rounded-action bg-primary px-lg text-on-primary transition-colors hover:bg-primary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="submit"
        >
          Pro로 업그레이드
          <ArrowUpRight aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </form>
      <p className="caption">Polar가 결제와 세금 처리를 담당합니다.</p>
    </div>
  );
}

function InsightShell({
  accent = false,
  children,
  icon,
  title,
}: {
  accent?: boolean;
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  const articleClassName = accent
    ? "ai-border-gradient ai-glow bg-canvas p-xl"
    : "rounded-card border border-hairline bg-canvas p-xl";

  const iconClassName = accent
    ? "ai-shimmer flex size-11 shrink-0 items-center justify-center rounded-circle text-on-primary"
    : "flex size-11 shrink-0 items-center justify-center rounded-circle bg-surface-strong text-ink";

  const titleClassName = accent ? "title-md ai-text-gradient" : "title-md";

  return (
    <article className={articleClassName}>
      <div className="relative z-[1] flex items-start gap-base">
        <div className={iconClassName}>{icon}</div>
        <div>
          <h2 className={titleClassName}>{title}</h2>
          <div className="mt-sm">{children}</div>
        </div>
      </div>
    </article>
  );
}
