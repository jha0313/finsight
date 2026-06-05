"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LogOut, RotateCcw, Settings, XCircle } from "lucide-react";

import type { Tier } from "@/types/tier";

import { PlanBadge } from "./PlanBadge";

const checkoutAction = "/api/checkout";
const subscriptionCancelAction = "/api/subscription/cancel";

export interface UserMenuProps {
  email: string | null;
  tier: Tier;
  cancelAtPeriodEnd: boolean;
  renewalLabel: string | null;
  signOutAction: () => Promise<void>;
}

export function UserMenu({
  email,
  tier,
  cancelAtPeriodEnd,
  renewalLabel,
  signOutAction,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current !== null &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (email?.trim().charAt(0) ?? "").toUpperCase() || "·";

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="계정 메뉴 열기"
        className="flex w-full items-center gap-sm rounded-field p-xs text-left transition-colors hover:bg-surface-soft"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Avatar initial={initial} />
        <span className="min-w-0 flex-1">
          <span className="body-sm block truncate text-ink">
            {email ?? "계정"}
          </span>
          <span className="mt-xxs block">
            <PlanBadge tier={tier} />
          </span>
        </span>
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-10 mb-sm w-full min-w-[240px] rounded-card border border-hairline bg-canvas p-xs shadow-card">
          <PlanSection
            cancelAtPeriodEnd={cancelAtPeriodEnd}
            renewalLabel={renewalLabel}
            tier={tier}
          />
          <div className="my-xs border-t border-hairline" />
          <Link className={menuItemClassName} href="/dashboard/settings">
            <Settings aria-hidden="true" size={16} strokeWidth={2} />
            설정
          </Link>
          <form action={signOutAction}>
            <button className={menuItemClassName} type="submit">
              <LogOut aria-hidden="true" size={16} strokeWidth={2} />
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function PlanSection({
  tier,
  cancelAtPeriodEnd,
  renewalLabel,
}: {
  tier: Tier;
  cancelAtPeriodEnd: boolean;
  renewalLabel: string | null;
}) {
  if (tier === "free") {
    return (
      <form action={checkoutAction} method="post">
        <button className={menuItemClassName} type="submit">
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={2} />
          Pro로 업그레이드
        </button>
      </form>
    );
  }

  if (cancelAtPeriodEnd) {
    return (
      <div>
        <p className="caption px-sm pb-xxs pt-xs text-muted">
          {renewalLabel !== null
            ? `${renewalLabel} 종료 후 Free 전환 예정`
            : "현재 기간 종료 후 Free 전환 예정"}
        </p>
        <form action={subscriptionCancelAction} method="post">
          <input name="action" type="hidden" value="resume" />
          <button className={menuItemClassName} type="submit">
            <RotateCcw aria-hidden="true" size={16} strokeWidth={2} />
            구독 유지하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={subscriptionCancelAction} method="post">
      <button className={menuItemClassName} type="submit">
        <XCircle aria-hidden="true" size={16} strokeWidth={2} />
        구독 취소
      </button>
    </form>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-circle bg-surface-strong">
      <span className="btn-label text-[13px] text-ink">{initial}</span>
    </span>
  );
}

const menuItemClassName =
  "nav-link flex w-full items-center gap-sm rounded-field px-sm py-xs text-left text-body transition-colors hover:bg-surface-soft hover:text-ink";
