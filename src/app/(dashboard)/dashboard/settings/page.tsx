import type { Metadata } from "next";

import { SettingsView } from "@/components/SettingsView";
import { formatDate } from "@/lib/format";
import {
  FREE_SUMMARY,
  getCurrentUser,
  getSubscriptionSummary,
} from "@/services/supabase";

import { signOutAction } from "../../actions";

export const metadata: Metadata = {
  title: "설정 | finsight",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const summary = user
    ? await getSubscriptionSummary(user.id)
    : FREE_SUMMARY;
  const renewalLabel =
    summary.currentPeriodEnd !== null
      ? formatDate(summary.currentPeriodEnd)
      : null;

  return (
    <SettingsView
      cancelAtPeriodEnd={summary.cancelAtPeriodEnd}
      email={user?.email ?? null}
      renewalLabel={renewalLabel}
      signOutAction={signOutAction}
      tier={summary.tier}
    />
  );
}
