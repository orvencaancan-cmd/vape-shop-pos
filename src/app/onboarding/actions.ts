"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existingProfile = await getCurrentProfile();

  if (existingProfile) {
    // Already onboarded (e.g. re-clicked). Send them where they belong.
    redirect(existingProfile.role === "owner" ? "/dashboard" : "/sell");
  }

  const shopName = (user.user_metadata?.pending_shop_name as string) || "My Shop";
  const displayName =
    (user.user_metadata?.pending_display_name as string | undefined) ?? null;

  const { error } = await supabase.rpc("create_shop", {
    shop_name: shopName,
    owner_display_name: displayName,
  });
  if (error) throw new Error(error.message);

  redirect("/dashboard");
}
