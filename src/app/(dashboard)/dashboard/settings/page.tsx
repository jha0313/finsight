import type { Metadata } from "next";

import { SettingsView } from "@/components/SettingsView";
import { formatDate } from "@/lib/format";
import { getCurrentUser, getSubscriptionSummary } from "@/services/supabase";

import { signOutAction } from "../../actions";

export const metadata: Metadata = {
  title: "설정 | finsight",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const summary = user
    ? await getSubscriptionSummary(user.id)
    : { tier: "free" as const, currentPeriodEnd: null };
  const renewalLabel =
    summary.currentPeriodEnd !== null
      ? formatDate(summary.currentPeriodEnd)
      : null;

  return (
    <SettingsView
      email={user?.email ?? null}
      renewalLabel={renewalLabel}
      signOutAction={signOutAction}
      tier={summary.tier}
    />
  );
}
