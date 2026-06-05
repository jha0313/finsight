"use server";

import { redirect } from "next/navigation";

import { signOutCurrentUser } from "@/services/supabase";

export async function signOutAction(): Promise<void> {
  await signOutCurrentUser();
  redirect("/");
}
