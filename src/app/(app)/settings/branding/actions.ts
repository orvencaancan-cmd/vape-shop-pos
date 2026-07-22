"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type ActionState = { error?: string };

const colorSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color"),
});

export async function updateColorAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = colorSchema.safeParse({ primaryColor: formData.get("primaryColor") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid color" };
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can update branding" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({ primary_color: parsed.data.primaryColor })
    .eq("id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
