"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type LoyaltySettingsState = { error?: string; success?: boolean };

const loyaltySettingsSchema = z.object({
  earnEnabled: z.boolean(),
  redeemEnabled: z.boolean(),
  rewardPercent: z.coerce.number().min(0, "Can't be negative").max(100, "Can't be over 100"),
});

export async function updateLoyaltySettingsAction(
  shopId: string,
  _prevState: LoyaltySettingsState,
  formData: FormData,
): Promise<LoyaltySettingsState> {
  const profile = await getCurrentProfile();
  const membership = profile?.shops.find((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !membership) return { error: "Not authorized" };

  const parsed = loyaltySettingsSchema.safeParse({
    earnEnabled: formData.get("earnEnabled") === "on",
    redeemEnabled: formData.get("redeemEnabled") === "on",
    rewardPercent: formData.get("rewardPercent") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({
      loyalty_earn_enabled: parsed.data.earnEnabled,
      loyalty_redeem_enabled: parsed.data.redeemEnabled,
      loyalty_reward_percent: parsed.data.rewardPercent,
    })
    .eq("id", shopId);
  if (error) return { error: error.message };

  revalidatePath("/settings/promos");
  return { success: true };
}

export type SaleSettingsState = { error?: string; success?: boolean };

const saleSettingsSchema = z
  .object({
    enabled: z.boolean(),
    percent: z.coerce.number().min(0, "Can't be negative").max(100, "Can't be over 100"),
    scope: z.enum(["branch", "items"]),
    startsAt: z.string(),
    endsAt: z.string(),
    productIds: z.array(z.string()),
  })
  .refine((data) => !(data.startsAt && data.endsAt && data.endsAt <= data.startsAt), {
    message: "End must be after start",
    path: ["endsAt"],
  });

export async function updateSaleSettingsAction(
  shopId: string,
  _prevState: SaleSettingsState,
  formData: FormData,
): Promise<SaleSettingsState> {
  const profile = await getCurrentProfile();
  const membership = profile?.shops.find((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !membership) return { error: "Not authorized" };

  const parsed = saleSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    percent: formData.get("percent") || 0,
    scope: formData.get("scope"),
    startsAt: formData.get("startsAt") || "",
    endsAt: formData.get("endsAt") || "",
    productIds: formData.getAll("productIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({
      sale_enabled: parsed.data.enabled,
      sale_percent: parsed.data.percent,
      sale_scope: parsed.data.scope,
      sale_starts_at: parsed.data.startsAt || null,
      sale_ends_at: parsed.data.endsAt || null,
    })
    .eq("id", shopId);
  if (error) return { error: error.message };

  // Only touch sale_promo_products when the scope is actually items --
  // leaving it alone otherwise lets a previous selection survive toggling
  // scope back and forth instead of being silently wiped every time.
  if (parsed.data.scope === "items") {
    const { data: ownedProducts } = await supabase
      .from("products")
      .select("id")
      .eq("shop_id", shopId)
      .in("id", parsed.data.productIds);
    const validIds = (ownedProducts ?? []).map((p) => p.id);

    const { error: deleteError } = await supabase
      .from("sale_promo_products")
      .delete()
      .eq("shop_id", shopId);
    if (deleteError) return { error: deleteError.message };

    if (validIds.length > 0) {
      const { error: insertError } = await supabase
        .from("sale_promo_products")
        .insert(validIds.map((productId) => ({ shop_id: shopId, product_id: productId })));
      if (insertError) return { error: insertError.message };
    }
  }

  revalidatePath("/settings/promos");
  revalidatePath("/sell");
  return { success: true };
}
