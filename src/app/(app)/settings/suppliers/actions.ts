"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string };

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactInfo: z.string().optional(),
});

export async function createSupplierAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    contactInfo: formData.get("contactInfo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("shop_id").single();

  const { error } = await supabase.from("suppliers").insert({
    shop_id: profile!.shop_id,
    name: parsed.data.name,
    contact_info: parsed.data.contactInfo || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/suppliers");
  return {};
}

export async function updateSupplierAction(
  supplierId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    contactInfo: formData.get("contactInfo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      contact_info: parsed.data.contactInfo || null,
    })
    .eq("id", supplierId);
  if (error) return { error: error.message };

  revalidatePath("/settings/suppliers");
  return {};
}

export async function deleteSupplierAction(supplierId: string) {
  const supabase = await createClient();
  await supabase.from("suppliers").delete().eq("id", supplierId);
  revalidatePath("/settings/suppliers");
}
