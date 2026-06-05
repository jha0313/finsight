import type { ReactNode } from "react";

import { Sidebar } from "@/components/Sidebar";
import { formatDate } from "@/lib/format";
import {
  FREE_SUMMARY,
  getCurrentUser,
  getSubscriptionSummary,
} from "@/services/supabase";

import { signOutAction } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const summary = user
    ? await getSubscriptionSummary(user.id)
    : FREE_SUMMARY;
  const renewalLabel =
    summary.currentPeriodEnd !== null
      ? formatDate(summary.currentPeriodEnd)
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft lg:flex-row">
      <Sidebar
        cancelAtPeriodEnd={summary.cancelAtPeriodEnd}
        email={user?.email ?? null}
        renewalLabel={renewalLabel}
        signOutAction={signOutAction}
        tier={summary.tier}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
