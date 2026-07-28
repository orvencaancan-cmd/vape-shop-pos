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

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  let resolvedSupplierId = supplierId || null;
  if (newSupplierName?.trim()) {
    const { data: newSupplier, error: supplierError } = await supabase
      .from("suppliers")
      .insert({ shop_id: profile.shopId, name: newSupplierName.trim() })
      .select("id")
      .single();
    if (supplierError) return { error: supplierError.message };
    resolvedSupplierId = newSupplier.id;
  }

  const { error } = await supabase.rpc("receive_stock", {
    p_shop_id: profile.shopId,
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

  let existingQuery = supabase
    .from("products")
    .select("id")
    .eq("shop_id", profile.shopId)
    .eq("category", parsed.data.category)
    .eq("archived", false)
    .ilike("name", parsed.data.name.trim());
  existingQuery = parsed.data.brand
    ? existingQuery.eq("brand", parsed.data.brand)
    : existingQuery.is("brand", null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) {
    return { error: `"${parsed.data.name}" already exists for this brand — edit that one instead.` };
  }

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

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

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
    .eq("id", productId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

export async function archiveProductAction(productId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ archived: true })
    .eq("id", productId)
    .eq("shop_id", profile.shopId);
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
  flavors: z
    .string()
    .transform((text) => text.split("\n").map((f) => f.trim()).filter(Boolean)),
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
    flavors: formData.get("flavors") ?? "",
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

  // Reuse an existing product for any flavor name that already exists under this
  // brand, instead of creating a second, visually-duplicate product card.
  let existingQuery = supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("category", "ejuice")
    .eq("archived", false);
  existingQuery = brand ? existingQuery.eq("brand", brand) : existingQuery.is("brand", null);
  const { data: existingProducts } = await existingQuery;
  const productIdByName = new Map(
    (existingProducts ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );

  const newNames = [...new Set(
    flavors.filter((name) => !productIdByName.has(name.trim().toLowerCase())),
  )];
  if (newNames.length > 0) {
    const { data: inserted, error: productsError } = await supabase
      .from("products")
      .insert(
        newNames.map((name) => ({
          shop_id: shopId,
          name,
          brand: brand || null,
          category: "ejuice" as const,
        })),
      )
      .select("id");
    if (productsError) return { error: productsError.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  const productIds = [...new Set(flavors.map((name) => productIdByName.get(name.trim().toLowerCase())!))];
  const { data: existingVariants } = productIds.length
    ? await supabase.from("variants").select("product_id, nicotine_mg, size").in("product_id", productIds)
    : { data: [] as { product_id: string; nicotine_mg: number | null; size: string | null }[] };
  const seenVariantKeys = new Set(
    (existingVariants ?? []).map((v) => `${v.product_id}|${v.nicotine_mg}|${v.size ?? ""}`),
  );

  const variantRows: {
    shop_id: string;
    product_id: string;
    flavor: string;
    nicotine_mg: number;
    size: string | null;
    cost: number;
    price: number;
    low_stock_threshold: number;
  }[] = [];
  for (const name of flavors) {
    const productId = productIdByName.get(name.trim().toLowerCase())!;
    for (const mg of nicotineLevels) {
      const key = `${productId}|${mg}|${size || ""}`;
      if (seenVariantKeys.has(key)) continue;
      seenVariantKeys.add(key);
      variantRows.push({
        shop_id: shopId,
        product_id: productId,
        flavor: name,
        nicotine_mg: mg,
        size: size || null,
        cost: effectiveCost,
        price,
        low_stock_threshold: lowStockThreshold,
      });
    }
  }

  if (variantRows.length > 0) {
    const { error: variantsError } = await supabase.from("variants").insert(variantRows);
    if (variantsError) return { error: variantsError.message };
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

const accessoryBatchSchema = z.object({
  subcategoryKey: z.string().min(1),
  brand: z.string().optional(),
  items: z.array(z.string()).transform((arr) => arr.map((f) => f.trim()).filter(Boolean)),
  variantOptions: z.array(z.string()).optional().default([]),
  variantOptionsText: z.string().optional(),
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
    variantOptionsText: formData.get("variantOptionsText") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const {
    subcategoryKey,
    brand,
    items,
    variantOptions,
    variantOptionsText,
    cost,
    price,
    lowStockThreshold,
  } = parsed.data;
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

  const productNames = items.map((item) => subcategory.nameTemplate(item));

  // Reuse an existing product for any item name that already exists under this
  // brand/subcategory, instead of creating a second, visually-duplicate card.
  let existingQuery = supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("category", "accessory")
    .eq("subcategory", subcategory.dbSubcategory)
    .eq("archived", false);
  existingQuery = brand ? existingQuery.eq("brand", brand) : existingQuery.is("brand", null);
  const { data: existingProducts } = await existingQuery;
  const productIdByName = new Map(
    (existingProducts ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );

  const newNames = [...new Set(
    productNames.filter((name) => !productIdByName.has(name.trim().toLowerCase())),
  )];
  if (newNames.length > 0) {
    const { data: inserted, error: productsError } = await supabase
      .from("products")
      .insert(
        newNames.map((name) => ({
          shop_id: shopId,
          name,
          brand: brand || null,
          category: "accessory" as const,
          subcategory: subcategory.dbSubcategory,
        })),
      )
      .select("id");
    if (productsError) return { error: productsError.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  let levels: (string | null)[];
  if (subcategory.variantDimension?.inputType === "freeText") {
    levels = [...new Set((variantOptionsText ?? "").split(",").map((v) => v.trim()).filter(Boolean))];
  } else if (subcategory.variantDimension) {
    levels = variantOptions;
  } else {
    levels = [null];
  }
  if (subcategory.variantDimension && levels.length === 0) {
    const verb = subcategory.variantDimension.inputType === "freeText" ? "Add" : "Select";
    return { error: `${verb} at least one ${subcategory.variantDimension.label.toLowerCase()}` };
  }

  const productIds = [...new Set(productNames.map((name) => productIdByName.get(name.trim().toLowerCase())!))];
  const { data: existingVariants } = productIds.length
    ? await supabase.from("variants").select("product_id, ohms, size, flavor").in("product_id", productIds)
    : {
        data: [] as { product_id: string; ohms: number | null; size: string | null; flavor: string | null }[],
      };
  const seenVariantKeys = new Set(
    (existingVariants ?? []).map((v) => `${v.product_id}|${v.ohms ?? ""}|${v.size ?? ""}|${v.flavor ?? ""}`),
  );

  const variantRows: {
    shop_id: string;
    product_id: string;
    for_device: string | null;
    ohms: number | null;
    size: string | null;
    flavor: string | null;
    cost: number;
    price: number;
    low_stock_threshold: number;
  }[] = [];
  items.forEach((item, i) => {
    const productId = productIdByName.get(productNames[i].trim().toLowerCase())!;
    const forDevice = subcategory.setForDevice ? item : null;
    for (const level of levels) {
      const ohms = subcategory.variantDimension?.field === "ohms" && level ? Number(level) : null;
      const size =
        subcategory.variantDimension?.field === "size" && level
          ? (subcategory.variantDimension.formatValue?.(level) ?? level)
          : null;
      const flavor =
        subcategory.variantDimension?.field === "flavor" && level
          ? (subcategory.variantDimension.formatValue?.(level) ?? level)
          : null;
      const key = `${productId}|${ohms ?? ""}|${size ?? ""}|${flavor ?? ""}`;
      if (seenVariantKeys.has(key)) continue;
      seenVariantKeys.add(key);
      variantRows.push({
        shop_id: shopId,
        product_id: productId,
        for_device: forDevice,
        ohms,
        size,
        flavor,
        cost: effectiveCost,
        price,
        low_stock_threshold: lowStockThreshold,
      });
    }
  });

  if (variantRows.length > 0) {
    const { error: variantsError } = await supabase.from("variants").insert(variantRows);
    if (variantsError) return { error: variantsError.message };
  }

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

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

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
    .eq("id", variantId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

export async function deleteVariantAction(variantId: string, productId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase.from("variants").delete().eq("id", variantId).eq("shop_id", profile.shopId);
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
}
