"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings } from "lucide-react";

import type { Tier } from "@/types/tier";

import { PlanBadge } from "./PlanBadge";
import { UserMenu } from "./UserMenu";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "대시보드", Icon: LayoutDashboard },
  { href: "/dashboard/settings", label: "설정", Icon: Settings },
];

export interface SidebarProps {
  email: string | null;
  tier: Tier;
  cancelAtPeriodEnd: boolean;
  renewalLabel: string | null;
  signOutAction: () => Promise<void>;
}

export function Sidebar({
  email,
  tier,
  cancelAtPeriodEnd,
  renewalLabel,
  signOutAction,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col border-b border-hairline bg-canvas lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-base px-lg py-base lg:px-base lg:py-lg">
        <Link className="caption-strong text-primary" href="/dashboard">
          finsight
        </Link>
        <span className="lg:hidden">
          <PlanBadge tier={tier} />
        </span>
      </div>

      <nav className="flex gap-xxs px-base pb-base lg:flex-1 lg:flex-col lg:pb-0">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={navItemClassName(active)}
              href={href}
              key={href}
            >
              <Icon
                className={active ? "text-primary" : undefined}
                size={18}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-hairline p-xs lg:block">
        <UserMenu
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          email={email}
          renewalLabel={renewalLabel}
          signOutAction={signOutAction}
          tier={tier}
        />
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navItemClassName(active: boolean): string {
  const base =
    "nav-link flex items-center gap-sm rounded-field px-sm py-xs transition-colors";

  return active
    ? `${base} bg-surface-strong text-ink`
    : `${base} text-muted hover:bg-surface-soft hover:text-ink`;
}
