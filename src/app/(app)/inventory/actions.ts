"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getAccessorySubcategory } from "@/lib/inventory/accessory-subcategories";

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
    const profile = await getCurrentProfile();
    if (!profile) return { error: "Not signed in" };
    const { data: newSupplier, error: supplierError } = await supabase
      .from("suppliers")
      .insert({ shop_id: profile.shopId, name: newSupplierName.trim() })
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
  subcategory: z.string().optional(),
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
    subcategory: formData.get("subcategory") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      shop_id: profile.shopId,
      name: parsed.data.name,
      brand: parsed.data.brand || null,
      category: parsed.data.category,
      subcategory: parsed.data.category === "accessory" ? parsed.data.subcategory || null : null,
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
    subcategory: formData.get("subcategory") ?? "",
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
      subcategory: parsed.data.category === "accessory" ? parsed.data.subcategory || null : null,
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
  const { error } = await supabase
    .from("products")
    .update({ archived: true })
    .eq("id", productId);
  if (error) {
    console.error("archiveProductAction failed:", error.message);
    return;
  }
  revalidatePath("/inventory");
  redirect("/inventory");
}

const flavorBatchSchema = z.object({
  brand: z.string().optional(),
  size: z.string().optional(),
  flavors: z.array(z.string()).transform((arr) => arr.map((f) => f.trim()).filter(Boolean)),
  nicotineLevels: z
    .array(z.coerce.number())
    .transform((arr) => [...new Set(arr)])
    .refine((arr) => arr.length > 0, "Select at least one nicotine level"),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative(),
});

export async function createFlavorBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = flavorBatchSchema.safeParse({
    brand: formData.get("brand") ?? "",
    size: formData.get("size") ?? "",
    flavors: formData.getAll("flavors"),
    nicotineLevels: formData.getAll("nicotineLevels"),
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { brand, size, flavors, nicotineLevels, cost, price, lowStockThreshold } = parsed.data;
  if (flavors.length === 0) {
    return { error: "Add at least one flavor" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  const shopId = profile.shopId;
  const effectiveCost = profile.role === "owner" ? cost : 0;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .insert(
      flavors.map((name) => ({
        shop_id: shopId,
        name,
        brand: brand || null,
        category: "ejuice" as const,
      })),
    )
    .select("id");
  if (productsError) return { error: productsError.message };

  const variantRows = products.flatMap((product) =>
    nicotineLevels.map((mg) => ({
      shop_id: shopId,
      product_id: product.id,
      nicotine_mg: mg,
      size: size || null,
      cost: effectiveCost,
      price,
      low_stock_threshold: lowStockThreshold,
    })),
  );
  const { error: variantsError } = await supabase.from("variants").insert(variantRows);
  if (variantsError) return { error: variantsError.message };

  revalidatePath("/inventory");
  redirect("/inventory");
}

const accessoryBatchSchema = z.object({
  subcategoryKey: z.string().min(1),
  brand: z.string().optional(),
  items: z.array(z.string()).transform((arr) => arr.map((f) => f.trim()).filter(Boolean)),
  variantOptions: z.array(z.string()).optional().default([]),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative(),
});

export async function createAccessoryBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accessoryBatchSchema.safeParse({
    subcategoryKey: formData.get("subcategoryKey"),
    brand: formData.get("brand") ?? "",
    items: formData.getAll("items"),
    variantOptions: formData.getAll("variantOptions"),
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { subcategoryKey, brand, items, variantOptions, cost, price, lowStockThreshold } =
    parsed.data;
  if (items.length === 0) {
    return { error: `Add at least one ${subcategoryKey === "cotton" ? "product" : "item"}` };
  }

  const subcategory = getAccessorySubcategory(subcategoryKey);
  if (!subcategory) {
    return { error: "Invalid accessory type" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  const shopId = profile.shopId;
  const effectiveCost = profile.role === "owner" ? cost : 0;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .insert(
      items.map((item) => ({
        shop_id: shopId,
        name: subcategory.nameTemplate(item),
        brand: brand || null,
        category: "accessory" as const,
        subcategory: subcategory.dbSubcategory,
      })),
    )
    .select("id");
  if (productsError) return { error: productsError.message };

  const levels = subcategory.variantDimension ? variantOptions : [null];
  if (subcategory.variantDimension && levels.length === 0) {
    return { error: `Select at least one ${subcategory.variantDimension.label.toLowerCase()}` };
  }

  const variantRows = products.flatMap((product, i) =>
    levels.map((level) => ({
      shop_id: shopId,
      product_id: product.id,
      for_device: subcategory.setForDevice ? items[i] : null,
      ohms: subcategory.variantDimension?.field === "ohms" && level ? Number(level) : null,
      size: subcategory.variantDimension?.field === "size" && level ? `${level}g` : null,
      cost: effectiveCost,
      price,
      low_stock_threshold: lowStockThreshold,
    })),
  );
  const { error: variantsError } = await supabase.from("variants").insert(variantRows);
  if (variantsError) return { error: variantsError.message };

  revalidatePath("/inventory");
  redirect("/inventory");
}

const variantSchema = z.object({
  flavor: z.string().optional(),
  nicotineMg: z.coerce.number().nonnegative().optional().or(z.nan()),
  size: z.string().optional(),
  forDevice: z.string().optional(),
  ohms: z.coerce.number().nonnegative().optional().or(z.nan()),
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
    forDevice: formData.get("forDevice") ?? "",
    ohms: formData.get("ohms") || undefined,
    sku: formData.get("sku") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const { error } = await supabase.from("variants").insert({
    shop_id: profile.shopId,
    product_id: productId,
    flavor: parsed.data.flavor || null,
    nicotine_mg: Number.isNaN(parsed.data.nicotineMg) ? null : parsed.data.nicotineMg,
    size: parsed.data.size || null,
    for_device: parsed.data.forDevice || null,
    ohms: Number.isNaN(parsed.data.ohms) ? null : parsed.data.ohms,
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
    forDevice: formData.get("forDevice") ?? "",
    ohms: formData.get("ohms") || undefined,
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
      for_device: parsed.data.forDevice || null,
      ohms: Number.isNaN(parsed.data.ohms) ? null : parsed.data.ohms,
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
