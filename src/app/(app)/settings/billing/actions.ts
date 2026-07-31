"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { TIER_AMOUNTS } from "@/lib/manual-payment";

export type ManualPaymentState = { error?: string; success?: boolean };

const manualPaymentSchema = z.object({
  method: z.enum(["gcash", "maya"], { message: "Choose GCash or Maya" }),
  referenceNote: z.string().trim().min(3, "Enter the reference number from your payment"),
});

export async function submitManualPaymentAction(
  shopId: string,
  _prevState: ManualPaymentState,
  formData: FormData,
): Promise<ManualPaymentState> {
  const profile = await getCurrentProfile();
  const membership = profile?.shops.find((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !membership) return { error: "Not authorized" };

  const parsed = manualPaymentSchema.safeParse({
    method: formData.get("method"),
    referenceNote: formData.get("referenceNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission" };
  }

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("billing_tier")
    .eq("id", shopId)
    .single();
  if (!shop) return { error: "Shop not found" };

  const { error } = await supabase.from("manual_payment_requests").insert({
    shop_id: shopId,
    method: parsed.data.method,
    amount: TIER_AMOUNTS[shop.billing_tier as "primary" | "additional"],
    reference_note: parsed.data.referenceNote,
    submitted_by: membership.profileId,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/billing");
  return { success: true };
}
