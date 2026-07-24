"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, ACTIVE_SHOP_COOKIE } from "@/lib/auth/get-current-profile";

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const ownedShopCount = profile.shops.filter((s) => s.role === "owner").length;
  if (ownedShopCount > 1) {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_SHOP_COOKIE); // always land in a fresh Admin Overview
    redirect("/dashboard");
  }
  redirect(profile.role === "owner" ? "/dashboard" : "/sell");
}
