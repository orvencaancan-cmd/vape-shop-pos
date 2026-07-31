import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteStaffResult = { error?: string; success?: string };

/**
 * Invites (or reattaches an existing, shop-less login as) staff at a
 * specific shop. Caller is responsible for verifying the current login is
 * an owner of `shopId` before calling this — this helper doesn't check.
 */
export async function inviteStaffToShop(input: {
  shopId: string;
  email: string;
  displayName: string;
  role: "owner" | "staff";
}): Promise<InviteStaffResult> {
  const { shopId, email, displayName, role } = input;

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/accept-invite`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
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
    const existingUser = userList.users.find((u) => u.email === email);
    if (!existingUser) return { error: inviteError.message };

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("shops(name)")
      .eq("user_id", existingUser.id)
      .maybeSingle();
    if (existingProfile) {
      const shop = Array.isArray(existingProfile.shops) ? existingProfile.shops[0] : existingProfile.shops;
      return {
        error: `${email} already belongs to another shop${shop?.name ? ` (${shop.name})` : ""} and can't be added here.`,
      };
    }

    userId = existingUser.id;
    needsFreshLink = !existingUser.last_sign_in_at;
  } else {
    userId = invited.user.id;
  }

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    shop_id: shopId,
    role,
    display_name: displayName || null,
  });
  if (profileError) return { error: profileError.message };

  if (needsFreshLink) {
    // Supabase won't re-send an invite email to an already-registered (but
    // never-confirmed) address, so a recovery email is reused as the
    // resend mechanism instead -- it works for any existing user
    // regardless of confirmation status. Flagging it in user_metadata lets
    // /reset-password/confirm route this person to the "welcome aboard"
    // screen instead of "choose a new password" once they click through.
    await admin.auth.admin.updateUserById(userId, { user_metadata: { pending_invite: true } });
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }

  return { success: `Added ${email} as ${role}` };
}
