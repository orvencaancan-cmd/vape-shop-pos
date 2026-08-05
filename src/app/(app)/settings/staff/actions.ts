"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { inviteStaffToShop } from "@/lib/staff/invite-staff";

export type ActionState = { error?: string; success?: string };

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  displayName: z.string().optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export async function inviteStaffAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName") ?? "",
    role: formData.get("role") || "staff",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can invite staff" };
  }

  const result = await inviteStaffToShop({
    shopId: profile.shopId,
    email: parsed.data.email,
    displayName: parsed.data.displayName ?? "",
    role: parsed.data.role,
  });
  if (result.error) return result;

  revalidatePath("/settings/staff");
  return result;
}

export async function resendInviteAction(email: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can resend invites" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/accept-invite`,
  });
  if (error) return { error: error.message };

  return { success: `Resent invite to ${email}` };
}

const roleSchema = z.object({ role: z.enum(["owner", "staff"]) });

export async function changeRoleAction(
  profileId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = roleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { error: "Invalid role" };

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can change roles" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath("/settings/staff");
  return {};
}

export async function removeStaffAction(profileId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath("/settings/staff");
  return {};
}

const adminInviteSchema = z.object({
  shopId: z.string().uuid(),
  email: z.string().email("Enter a valid email"),
  displayName: z.string().optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export async function inviteStaffToBranchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = adminInviteSchema.safeParse({
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

  revalidatePath("/settings/staff");
  return result;
}

export async function changeRoleInBranchAction(
  profileId: string,
  shopId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = roleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) return { error: "Invalid role" };

  const profile = await getCurrentProfile();
  const owns = profile?.shops.some((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !owns) {
    return { error: "You must own that branch to change roles there" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId)
    .eq("shop_id", shopId);
  if (error) return { error: error.message };

  revalidatePath("/settings/staff");
  return {};
}

export async function removeStaffFromBranchAction(
  profileId: string,
  shopId: string,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  const owns = profile?.shops.some((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !owns) return { error: "You must own that branch to remove staff there" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("shop_id", shopId);
  if (error) return { error: error.message };

  revalidatePath("/settings/staff");
  return {};
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

  revalidatePath("/settings/staff");
  return { success: "Staff member transferred" };
}
