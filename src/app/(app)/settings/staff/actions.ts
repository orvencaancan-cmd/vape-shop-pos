"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error?: string; success?: string };

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  displayName: z.string().optional(),
});

export async function inviteStaffAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("shop_id, role").single();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can invite staff" };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/accept-invite` },
  );
  if (inviteError) return { error: inviteError.message };

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    shop_id: profile.shop_id,
    role: "staff",
    display_name: parsed.data.displayName || null,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/settings/staff");
  return { success: `Invited ${parsed.data.email}` };
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
