"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type ActionState = { error?: string };

const schema = z.object({ shopName: z.string().min(1, "Shop name is required") });

export async function addShopAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({ shopName: formData.get("shopName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only shop owners can add another shop" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shop", {
    shop_name: parsed.data.shopName,
    owner_display_name: profile.displayName,
  });
  if (error) return { error: error.message };

  redirect("/settings/shops");
}
