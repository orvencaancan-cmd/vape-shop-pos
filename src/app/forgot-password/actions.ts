"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: string };

const schema = z.object({ email: z.string().email("Enter a valid email") });

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  // Never reveal whether the email has an account — always the same message,
  // except a genuine send failure (e.g. rate limit) is worth surfacing.
  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { error: "Too many attempts — please wait a bit and try again." };
  }

  return { success: "If that email has an account, we've sent a link to reset your password." };
}
