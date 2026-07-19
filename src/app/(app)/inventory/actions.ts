"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string };

const receiveStockSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  newSupplierName: z.string().optional(),
  unitCost: z.coerce.number().nonnegative().optional().or(z.nan()),
  note: z.string().optional(),
});

export async function receiveStockAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = receiveStockSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
    supplierId: formData.get("supplierId") ?? "",
    newSupplierName: formData.get("newSupplierName") ?? "",
    unitCost: formData.get("unitCost") || undefined,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { variantId, quantity, supplierId, newSupplierName, unitCost, note } =
    parsed.data;

  const supabase = await createClient();

  let resolvedSupplierId = supplierId || null;
  if (newSupplierName?.trim()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("shop_id")
      .single();
    const { data: newSupplier, error: supplierError } = await supabase
      .from("suppliers")
      .insert({ shop_id: profile!.shop_id, name: newSupplierName.trim() })
      .select("id")
      .single();
    if (supplierError) return { error: supplierError.message };
    resolvedSupplierId = newSupplier.id;
  }

  const { error } = await supabase.rpc("receive_stock", {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_supplier_id: resolvedSupplierId,
    p_unit_cost: Number.isNaN(unitCost) ? null : unitCost ?? null,
    p_note: note?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return {};
}

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().optional(),
  category: z.enum(["ejuice", "accessory"]),
  description: z.string().optional(),
});

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand") ?? "",
    category: formData.get("category"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .single();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      shop_id: profile!.shop_id,
      name: parsed.data.name,
      brand: parsed.data.brand || null,
      category: parsed.data.category,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect(`/inventory/${product.id}`);
}

export async function updateProductAction(
  productId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand") ?? "",
    category: formData.get("category"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      brand: parsed.data.brand || null,
      category: parsed.data.category,
      description: parsed.data.description,
    })
    .eq("id", productId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

export async function archiveProductAction(productId: string) {
  const supabase = await createClient();
  await supabase.from("products").update({ archived: true }).eq("id", productId);
  revalidatePath("/inventory");
  redirect("/inventory");
}

const variantSchema = z.object({
  flavor: z.string().optional(),
  nicotineMg: z.coerce.number().nonnegative().optional().or(z.nan()),
  size: z.string().optional(),
  sku: z.string().optional(),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative(),
});

export async function createVariantAction(
  productId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = variantSchema.safeParse({
    flavor: formData.get("flavor") ?? "",
    nicotineMg: formData.get("nicotineMg") || undefined,
    size: formData.get("size") ?? "",
    sku: formData.get("sku") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_id")
    .single();

  const { error } = await supabase.from("variants").insert({
    shop_id: profile!.shop_id,
    product_id: productId,
    flavor: parsed.data.flavor || null,
    nicotine_mg: Number.isNaN(parsed.data.nicotineMg) ? null : parsed.data.nicotineMg,
    size: parsed.data.size || null,
    sku: parsed.data.sku || null,
    cost: parsed.data.cost,
    price: parsed.data.price,
    low_stock_threshold: parsed.data.lowStockThreshold,
  });
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

export async function updateVariantAction(
  variantId: string,
  productId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = variantSchema.safeParse({
    flavor: formData.get("flavor") ?? "",
    nicotineMg: formData.get("nicotineMg") || undefined,
    size: formData.get("size") ?? "",
    sku: formData.get("sku") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("variants")
    .update({
      flavor: parsed.data.flavor || null,
      nicotine_mg: Number.isNaN(parsed.data.nicotineMg) ? null : parsed.data.nicotineMg,
      size: parsed.data.size || null,
      sku: parsed.data.sku || null,
      cost: parsed.data.cost,
      price: parsed.data.price,
      low_stock_threshold: parsed.data.lowStockThreshold,
    })
    .eq("id", variantId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

export async function deleteVariantAction(variantId: string, productId: string) {
  const supabase = await createClient();
  await supabase.from("variants").delete().eq("id", variantId);
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
}
