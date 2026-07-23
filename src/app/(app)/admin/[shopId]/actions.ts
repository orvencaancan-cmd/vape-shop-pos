// Account-level only: never query products/variants/sales/sale_items/stock_receipts/suppliers here.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error?: string };

export async function suspendShopAction(shopId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.platformAdmin) return;

  const admin = createAdminClient();
  await admin.from("shops").update({ suspended_at: new Date().toISOString() }).eq("id", shopId);
  revalidatePath(`/admin/${shopId}`);
  revalidatePath("/admin");
}

export async function reactivateShopAction(shopId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.platformAdmin) return;

  const admin = createAdminClient();
  await admin.from("shops").update({ suspended_at: null }).eq("id", shopId);
  revalidatePath(`/admin/${shopId}`);
  revalidatePath("/admin");
}

const trialSchema = z.object({
  trialEndsAt: z.string().min(1, "Pick a date"),
});

export async function updateTrialEndAction(
  shopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile?.platformAdmin) return { error: "Not authorized" };

  const parsed = trialSchema.safeParse({ trialEndsAt: formData.get("trialEndsAt") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid date" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("shops")
    .update({ trial_ends_at: new Date(`${parsed.data.trialEndsAt}T00:00:00.000Z`).toISOString() })
    .eq("id", shopId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${shopId}`);
  return {};
}
