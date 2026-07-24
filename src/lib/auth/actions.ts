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

export async function switchShopAction(shopId: string, role: "owner" | "staff") {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE, shopId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(role === "owner" ? "/dashboard" : "/sell");
}
