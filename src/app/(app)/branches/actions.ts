"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { inviteStaffToShop } from "@/lib/staff/invite-staff";

export type ActionState = { error?: string; success?: string };

const inviteSchema = z.object({
  shopId: z.string().uuid(),
  email: z.string().email("Enter a valid email"),
  displayName: z.string().optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export async function inviteStaffAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    shopId: formData.get("shopId"),
    email: formData.get("email"),
    displayName: formData.get("displayName") ?? "",
    role: formData.get("role") || "staff",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  const owns = profile?.shops.some(
    (s) => s.shopId === parsed.data.shopId && s.role === "owner",
  );
  if (!profile || !owns) {
    return { error: "You must be an owner of that branch to invite staff there" };
  }

  const result = await inviteStaffToShop({
    shopId: parsed.data.shopId,
    email: parsed.data.email,
    displayName: parsed.data.displayName ?? "",
    role: parsed.data.role,
  });
  if (result.error) return result;

  revalidatePath("/branches");
  return result;
}

export async function transferStaffAction(
  profileId: string,
  fromShopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const toShopId = String(formData.get("toShopId") ?? "");
  if (!toShopId) return { error: "Pick a destination branch" };

  const profile = await getCurrentProfile();
  const ownsBoth =
    profile?.shops.some((s) => s.shopId === fromShopId && s.role === "owner") &&
    profile?.shops.some((s) => s.shopId === toShopId && s.role === "owner");
  if (!profile || !ownsBoth) {
    return { error: "You must own both the source and destination branch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_staff", {
    p_profile_id: profileId,
    p_from_shop_id: fromShopId,
    p_to_shop_id: toShopId,
  });
  if (error) return { error: error.message };

  revalidatePath("/branches");
  return { success: "Staff member transferred" };
}
