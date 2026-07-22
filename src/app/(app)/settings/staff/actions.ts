"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

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

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/accept-invite`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo },
  );

  let userId: string;
  let needsFreshLink = false;

  if (inviteError) {
    if (!inviteError.message.toLowerCase().includes("already been registered")) {
      return { error: inviteError.message };
    }

    // This email already has a login (e.g. a removed staff member, or an
    // invite that was never completed) -- reattach it instead of erroring,
    // as long as it isn't already tied to a different shop.
    const { data: userList, error: listError } = await admin.auth.admin.listUsers();
    if (listError) return { error: listError.message };
    const existingUser = userList.users.find((u) => u.email === parsed.data.email);
    if (!existingUser) return { error: inviteError.message };

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("shops(name)")
      .eq("id", existingUser.id)
      .maybeSingle();
    if (existingProfile) {
      const shop = Array.isArray(existingProfile.shops) ? existingProfile.shops[0] : existingProfile.shops;
      return {
        error: `${parsed.data.email} already belongs to another shop${shop?.name ? ` (${shop.name})` : ""} and can't be added here.`,
      };
    }

    userId = existingUser.id;
    needsFreshLink = !existingUser.last_sign_in_at;
  } else {
    userId = invited.user.id;
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    shop_id: profile.shopId,
    role: parsed.data.role,
    display_name: parsed.data.displayName || null,
  });
  if (profileError) return { error: profileError.message };

  if (needsFreshLink) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  }

  revalidatePath("/settings/staff");
  return { success: `Added ${parsed.data.email} as ${parsed.data.role}` };
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/settings/staff");
  return {};
}

export async function removeStaffAction(profileId: string) {
  const supabase = await createClient();
  await supabase.from("profiles").delete().eq("id", profileId);
  revalidatePath("/settings/staff");
}
