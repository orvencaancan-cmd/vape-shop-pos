"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, ACTIVE_SHOP_COOKIE } from "@/lib/auth/get-current-profile";
import { startSubscriptionAction } from "@/app/(app)/settings/billing/actions";

export type ActionState = { error?: string; success?: string };

const addShopSchema = z.object({ shopName: z.string().min(1, "Shop name is required") });

export async function addShopAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addShopSchema.safeParse({ shopName: formData.get("shopName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only shop owners can add another shop" };

  const supabase = await createClient();

  // Someone who's already proven they'll pay (an active subscription on
  // another shop) doesn't need another free trial to decide -- skip
  // straight to checkout for the new branch. A first-time owner still
  // gets the normal card-less trial on every new shop, including this one.
  const ownedShopIds = profile.shops.filter((s) => s.role === "owner").map((s) => s.shopId);
  const { data: activeShopsElsewhere } = await supabase
    .from("shops")
    .select("id")
    .in("id", ownedShopIds)
    .eq("subscription_status", "active")
    .limit(1);
  const alreadySubscribed = (activeShopsElsewhere?.length ?? 0) > 0;

  const { data: newShopId, error } = await supabase.rpc("create_shop", {
    shop_name: parsed.data.shopName,
    owner_display_name: profile.displayName,
  });
  if (error) return { error: error.message };

  if (alreadySubscribed && newShopId) {
    // Always redirects (to Stripe Checkout, or back to /branches on
    // failure) -- never returns normally.
    await startSubscriptionAction(newShopId as string);
  }

  redirect("/branches");
}

export async function archiveShopAction(shopId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) {
    return { error: "You must own this branch to archive it" };
  }
  const activeOwnedCount = profile.shops.filter(
    (s) => s.role === "owner" && !s.archivedAt,
  ).length;
  if (activeOwnedCount <= 1) {
    return { error: "You need at least one active branch — add or reactivate another first." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", shopId);
  if (error) return { error: error.message };

  // If this was the owner's currently-active shop, clear it so they land
  // back in Admin Overview instead of hitting the shop-suspended gate for
  // their own voluntary action.
  if (profile.shopId === shopId) {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_SHOP_COOKIE);
  }

  revalidatePath("/branches");
  revalidatePath("/dashboard");
  return { success: "Branch archived" };
}

export async function reactivateShopAction(shopId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) {
    return { error: "You must own this branch to reactivate it" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shops").update({ archived_at: null }).eq("id", shopId);
  if (error) return { error: error.message };

  revalidatePath("/branches");
  revalidatePath("/dashboard");
  return { success: "Branch reactivated" };
}
