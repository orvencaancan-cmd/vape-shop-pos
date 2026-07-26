"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type ActionState = { error?: string; success?: boolean };

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
  return { success: true };
}

const LOGO_EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function updateLogoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can update branding" };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file" };
  }
  const ext = LOGO_EXT_BY_TYPE[file.type];
  if (!ext) return { error: "Please upload a PNG, JPG, or WebP image" };
  if (file.size > 2 * 1024 * 1024) return { error: "Image must be under 2MB" };

  const supabase = await createClient();
  const path = `${profile.shopId}/logo.${ext}`;

  // Best-effort cleanup of a logo previously uploaded in a different format --
  // the fixed filename means same-extension re-uploads just overwrite in place.
  const staleExts = Object.values(LOGO_EXT_BY_TYPE).filter((e) => e !== ext);
  await supabase.storage
    .from("shop-logos")
    .remove(staleExts.map((e) => `${profile.shopId}/logo.${e}`));

  const { error: uploadError } = await supabase.storage
    .from("shop-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("shop-logos").getPublicUrl(path);
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("shops")
    .update({ logo_url: logoUrl })
    .eq("id", profile.shopId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// Signature (state, formData) is required by useActionState -- neither is needed here.
export async function removeLogoAction(): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    return { error: "Only the shop owner can update branding" };
  }

  const supabase = await createClient();
  const allExts = Object.values(LOGO_EXT_BY_TYPE);
  await supabase.storage
    .from("shop-logos")
    .remove(allExts.map((e) => `${profile.shopId}/logo.${e}`));

  const { error } = await supabase
    .from("shops")
    .update({ logo_url: null })
    .eq("id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
