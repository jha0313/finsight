import type { ReactNode } from "react";

import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser, getSubscriptionSummary } from "@/services/supabase";

import { signOutAction } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const summary = user
    ? await getSubscriptionSummary(user.id)
    : { tier: "free" as const, currentPeriodEnd: null };

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft lg:flex-row">
      <Sidebar
        email={user?.email ?? null}
        signOutAction={signOutAction}
        tier={summary.tier}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
