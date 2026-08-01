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
