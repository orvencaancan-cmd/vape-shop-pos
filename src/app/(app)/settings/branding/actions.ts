"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string };

export async function uploadLogoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first" };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Logo must be an image" };
  }
  if (file.size > 4.5 * 1024 * 1024) {
    return { error: "Logo must be under 4.5MB" };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("shop_id, role").single();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can update branding" };
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${profile.shop_id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("shop-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("shop-logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("shops")
    .update({ logo_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", profile.shop_id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/", "layout");
  return {};
}

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

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("shop_id, role").single();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can update branding" };
  }

  const { error } = await supabase
    .from("shops")
    .update({ primary_color: parsed.data.primaryColor })
    .eq("id", profile.shop_id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
