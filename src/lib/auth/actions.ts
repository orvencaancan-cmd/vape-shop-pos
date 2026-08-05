"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SHOP_COOKIE } from "./get-current-profile";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function switchShopAction(shopId: string, role: "owner" | "staff", next?: string) {
  // getCurrentProfile() re-derives the active shop from real memberships and
  // falls back to the first one on a mismatch, so a forged shopId here was
  // already harmless -- but that made it "safe by accident of a downstream
  // check" rather than safe by construction. Verify membership here too.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE, shopId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next ?? (role === "owner" ? "/dashboard" : "/sell"));
}

export async function backToAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_SHOP_COOKIE);
  redirect("/dashboard");
}
