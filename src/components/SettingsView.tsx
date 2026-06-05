import type { ReactNode } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";

import type { Tier } from "@/types/tier";

import { PlanBadge } from "./PlanBadge";

const checkoutAction = "/api/checkout";

export interface SettingsViewProps {
  email: string | null;
  tier: Tier;
  renewalLabel: string | null;
  signOutAction: () => Promise<void>;
}

export function SettingsView({
  email,
  tier,
  renewalLabel,
  signOutAction,
}: SettingsViewProps) {
  return (
    <main className="min-h-screen bg-surface-soft">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-xl px-lg py-xxl">
        <header>
          <p className="caption-strong">설정</p>
          <h1 className="display-sm mt-base">계정과 플랜을 관리합니다.</h1>
        </header>

        <PlanCard renewalLabel={renewalLabel} tier={tier} />
        <DisplaySettingsCard />
        <AccountCard email={email} signOutAction={signOutAction} />
      </div>
    </main>
  );
}

function PlanCard({
  tier,
  renewalLabel,
}: {
  tier: Tier;
  renewalLabel: string | null;
}) {
  return (
    <SettingsCard
      action={
        <div className="flex items-center gap-sm">
          <PlanBadge tier={tier} />
        </div>
      }
      title="플랜 & 구독"
    >
      {tier === "pro" ? (
        <>
          <p className="body-sm">
            Opus 심층 분석을 사용 중입니다. 결제·취소는 Polar 고객 포털에서
            관리할 수 있습니다.
          </p>
          {renewalLabel !== null ? (
            <p className="body-sm mt-sm text-muted">
              다음 갱신일 <span className="num text-ink">{renewalLabel}</span>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="body-sm">
            현재 Free 플랜입니다. Pro로 업그레이드하면 Opus 심층 분석과 더 높은
            일일 분석 한도를 사용할 수 있습니다.
          </p>
          <div className="mt-base flex flex-col gap-sm sm:flex-row sm:items-center">
            <form action={checkoutAction} method="post">
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
        </>
      )}
    </SettingsCard>
  );
}

function DisplaySettingsCard() {
  return (
    <SettingsCard title="표시 설정">
      <dl className="divide-y divide-hairline">
        <div className="flex items-center justify-between py-sm">
          <dt className="body-sm text-ink">언어</dt>
          <dd className="body-sm text-muted">한국어</dd>
        </div>
      </dl>
      <p className="caption mt-sm">
        테마·통화 등 추가 표시 설정은 준비 중입니다.
      </p>
    </SettingsCard>
  );
}

function AccountCard({
  email,
  signOutAction,
}: {
  email: string | null;
  signOutAction: () => Promise<void>;
}) {
  return (
    <SettingsCard title="계정">
      {email !== null ? (
        <p className="body-sm">
          로그인 계정 <span className="text-ink">{email}</span>
        </p>
      ) : (
        <p className="body-sm text-muted">로그인 정보를 불러올 수 없습니다.</p>
      )}
      <form action={signOutAction} className="mt-base">
        <button
          className="btn-label inline-flex min-h-11 items-center justify-center gap-xs rounded-action border border-hairline bg-canvas px-lg text-ink transition-colors hover:bg-surface-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="submit"
        >
          <LogOut aria-hidden="true" size={18} strokeWidth={2} />
          로그아웃
        </button>
      </form>
    </SettingsCard>
  );
}

function SettingsCard({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-card border border-hairline bg-canvas p-xl">
      <div className="flex items-center justify-between gap-base">
        <h2 className="title-md">{title}</h2>
        {action}
      </div>
      <div className="mt-base">{children}</div>
    </section>
  );
}
