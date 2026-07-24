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

export async function removeStaffAction(profileId: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") return;

  const supabase = await createClient();
  await supabase.from("profiles").delete().eq("id", profileId).eq("shop_id", profile.shopId);
  revalidatePath("/settings/staff");
}
