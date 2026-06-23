"use server";

import { redirect } from "next/navigation";

import { getPostHogClient } from "@/services/posthog/analytics";
import { getCurrentUser, signOutCurrentUser } from "@/services/supabase";

export async function signOutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "user_signed_out",
    });
  }
  await signOutCurrentUser();
  redirect("/");
}
