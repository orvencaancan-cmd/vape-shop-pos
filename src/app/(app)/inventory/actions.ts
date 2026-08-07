"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getProductCategory, ALL_CATEGORIES } from "@/lib/inventory/product-categories";
import { variantLabel } from "@/lib/variant-label";

export type ActionState = { error?: string };

// Case-insensitive find-or-create, shared by anywhere a free-text supplier
// name needs to become a supplier_id (Add E-juice, editing an existing
// product).
async function resolveSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  supplierName: string | undefined,
): Promise<{ id: string | null; error?: string }> {
  const name = supplierName?.trim();
  if (!name) return { id: null };
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("shop_id", shopId)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { id: existing.id };
  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({ shop_id: shopId, name })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: created.id };
}

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

const correctStockSchema = z.object({
  variantId: z.string().uuid(),
  newQty: z.coerce.number().int().min(0, "Quantity can't be negative"),
  reason: z.string().trim().min(1, "A reason is required"),
});

// Fixes a wrong stock count directly (e.g. miscounted at setup, damage
// never logged) without running a full physical audit for one item.
// Owner-only, reason required -- enforced again inside correct_stock()
// itself (security definer), not just here, same defense-in-depth as
// every other money/stock-moving RPC in this app.
export async function correctStockAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = correctStockSchema.safeParse({
    variantId: formData.get("variantId"),
    newQty: formData.get("newQty"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  if (profile.role !== "owner") return { error: "Only the shop admin can correct stock" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_stock", {
    p_shop_id: profile.shopId,
    p_variant_id: parsed.data.variantId,
    p_new_qty: parsed.data.newQty,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return {};
}

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().optional(),
  category: z.enum(ALL_CATEGORIES as [string, ...string[]]),
  description: z.string().optional(),
  supplier: z.string().optional(),
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
    supplier: formData.get("supplier") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const resolvedSupplier = await resolveSupplierId(supabase, profile.shopId, parsed.data.supplier);
  if (resolvedSupplier.error) return { error: resolvedSupplier.error };

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      brand: parsed.data.brand || null,
      category: parsed.data.category,
      description: parsed.data.description,
      supplier_id: resolvedSupplier.id,
    })
    .eq("id", productId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}

// Sets (or clears) the supplier for every product sharing a brand at once --
// the per-product edit form only ever touches one product, which is tedious
// for a brand with several flavors.
export async function updateBrandSupplierAction(
  brand: string | null,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const resolvedSupplier = await resolveSupplierId(
    supabase,
    profile.shopId,
    String(formData.get("supplier") ?? ""),
  );
  if (resolvedSupplier.error) return { error: resolvedSupplier.error };

  let query = supabase
    .from("products")
    .update({ supplier_id: resolvedSupplier.id })
    .eq("shop_id", profile.shopId)
    .eq("archived", false);
  query = brand ? query.eq("brand", brand) : query.is("brand", null);
  const { error } = await query;
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return {};
}

// Sets the unit cost for every variant at one nicotine level across every
// e-juice product sharing a brand at once. Scoped by nicotine level because
// cost commonly varies by strength within a brand (e.g. 12mg vs 24mg vs 36mg
// all pricing differently) even though every flavor at a given strength
// shares one cost -- cost previously only lived on the per-variant edit form
// (or as a side effect of logging a stock receipt), tedious to correct one
// flavor at a time. Scoped to category='ejuice' -- accessory cost bulk-edits
// go through updateAccessoryCostAction below instead, since nicotine level
// isn't a meaningful axis for them.
export async function updateBrandCostAction(
  brand: string | null,
  nicotineMg: number,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  if (profile.role !== "owner") return { error: "Only the shop admin can edit cost" };

  const cost = Number(formData.get("cost"));
  if (!Number.isFinite(cost) || cost < 0) return { error: "Invalid cost" };

  const supabase = await createClient();

  let productQuery = supabase
    .from("products")
    .select("id")
    .eq("shop_id", profile.shopId)
    .eq("category", "ejuice")
    .eq("archived", false);
  productQuery = brand ? productQuery.eq("brand", brand) : productQuery.is("brand", null);
  const { data: products } = await productQuery;
  const productIds = (products ?? []).map((p) => p.id);
  if (productIds.length === 0) return {};

  const { error } = await supabase
    .from("variants")
    .update({ cost })
    .eq("shop_id", profile.shopId)
    .in("product_id", productIds)
    .eq("nicotine_mg", nicotineMg);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return {};
}

// Accessory-category counterpart to updateBrandCostAction above -- these
// categories have no nicotine dimension, but a brand can span several
// distinct categories (e.g. OXVA sells both a Device and a Cartridge), and
// those don't share a cost just because they share a brand. Scoped by
// category instead of just brand, so "Cartridge cost" and "Device cost"
// are edited separately rather than one flat field silently overwriting
// everything under the brand (which was the bug -- an Oneo Cartridge and
// an XLIM Cartridge got the same cost purely because both happened to have
// no nicotine level).
export async function updateCategoryCostAction(
  brand: string | null,
  category: string,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  if (profile.role !== "owner") return { error: "Only the shop admin can edit cost" };

  const cost = Number(formData.get("cost"));
  if (!Number.isFinite(cost) || cost < 0) return { error: "Invalid cost" };

  const supabase = await createClient();

  let productQuery = supabase
    .from("products")
    .select("id")
    .eq("shop_id", profile.shopId)
    .eq("category", category)
    .eq("archived", false);
  productQuery = brand ? productQuery.eq("brand", brand) : productQuery.is("brand", null);
  const { data: products } = await productQuery;
  const productIds = (products ?? []).map((p) => p.id);
  if (productIds.length === 0) return {};

  const { error } = await supabase
    .from("variants")
    .update({ cost })
    .eq("shop_id", profile.shopId)
    .in("product_id", productIds);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  return {};
}

const addBrandFlavorsSchema = z.object({
  flavors: z
    .string()
    .transform((s) => s.split("\n").map((f) => f.trim()).filter(Boolean)),
});

// Quick "a new flavor just came in" shortcut for an existing e-juice brand --
// available to owner AND staff, unlike the Supplier/Cost brand-level edits
// above, since it doesn't ask for anything role-sensitive: just the flavor
// name(s). Every other detail (nicotine levels, size, cost, price) is
// inferred from that brand's existing flavors, since a new flavor line
// almost always just extends what's already there rather than introducing a
// new strength/size/pricing scheme.
export async function addBrandFlavorsAction(
  brand: string | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addBrandFlavorsSchema.safeParse({ flavors: formData.get("flavors") ?? "" });
  if (!parsed.success || parsed.data.flavors.length === 0) return { error: "Enter at least one flavor" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const shopId = profile.shopId;

  let existingQuery = supabase
    .from("products")
    .select("id, name, supplier_id")
    .eq("shop_id", shopId)
    .eq("category", "ejuice")
    .eq("archived", false);
  existingQuery = brand ? existingQuery.eq("brand", brand) : existingQuery.is("brand", null);
  const { data: existingProducts } = await existingQuery;
  const productIds = (existingProducts ?? []).map((p) => p.id);
  if (productIds.length === 0) return { error: "No existing flavors for this brand to copy from" };

  const { data: existingVariants } = await supabase
    .from("variants")
    .select("product_id, nicotine_mg, size, cost, price")
    .eq("shop_id", shopId)
    .in("product_id", productIds);

  const levels = [
    ...new Set((existingVariants ?? []).map((v) => v.nicotine_mg).filter((n): n is number => n != null)),
  ];
  if (levels.length === 0) return { error: "No existing flavors for this brand to copy from" };

  const sizes = new Set((existingVariants ?? []).map((v) => v.size).filter((s): s is string => !!s));
  const commonSize = sizes.size === 1 ? [...sizes][0] : null;

  const supplierIds = new Set(
    (existingProducts ?? []).map((p) => p.supplier_id).filter((id): id is string => !!id),
  );
  const commonSupplierId = supplierIds.size === 1 ? [...supplierIds][0] : null;

  function valueForLevel(mg: number, field: "cost" | "price"): number {
    const values = new Set(
      (existingVariants ?? []).filter((v) => v.nicotine_mg === mg).map((v) => Number(v[field])),
    );
    return values.size === 1 ? [...values][0] : 0;
  }

  const productIdByName = new Map(
    (existingProducts ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );
  const newNames = parsed.data.flavors.filter((name) => !productIdByName.has(name.trim().toLowerCase()));
  if (newNames.length > 0) {
    const { data: inserted, error } = await supabase
      .from("products")
      .insert(
        newNames.map((name) => ({
          shop_id: shopId,
          name,
          brand,
          category: "ejuice" as const,
          supplier_id: commonSupplierId,
        })),
      )
      .select("id");
    if (error) return { error: error.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  const targetProductIds = [
    ...new Set(parsed.data.flavors.map((name) => productIdByName.get(name.trim().toLowerCase())!)),
  ];

  const { data: alreadyHaveVariants } = await supabase
    .from("variants")
    .select("product_id, nicotine_mg")
    .in("product_id", targetProductIds);
  const seenVariantKeys = new Set(
    (alreadyHaveVariants ?? []).map((v) => `${v.product_id}|${v.nicotine_mg}`),
  );

  // Staff can add flavors here, but RLS only allows a staff-authored variant
  // insert when cost is 0 (variants_insert_member) -- same rule every other
  // staff-facing add flow in this file already follows.
  const effectiveCostFor = (mg: number) =>
    profile.role === "owner" ? valueForLevel(mg, "cost") : 0;

  const variantRows: {
    shop_id: string;
    product_id: string;
    nicotine_mg: number;
    size: string | null;
    cost: number;
    price: number;
  }[] = [];
  for (const productId of targetProductIds) {
    for (const mg of levels) {
      const key = `${productId}|${mg}`;
      if (seenVariantKeys.has(key)) continue;
      seenVariantKeys.add(key);
      variantRows.push({
        shop_id: shopId,
        product_id: productId,
        nicotine_mg: mg,
        size: commonSize,
        cost: effectiveCostFor(mg),
        price: valueForLevel(mg, "price"),
      });
    }
  }

  if (variantRows.length > 0) {
    const { error } = await supabase.from("variants").insert(variantRows);
    if (error) return { error: error.message };
  }

  revalidatePath("/inventory");
  return {};
}

export type RestockHistoryRow = {
  date: string;
  label: string;
  quantity: number;
  receivedByName: string | null;
};

// Fetched on demand (not on every Inventory page load) -- an earlier fix
// this session deliberately removed a similar unbounded stock_receipts join
// from the main page query once it stopped being used, specifically to keep
// Inventory light. This one only runs when the owner/staff actually opens
// "View restock history" for a brand, and is capped to the most recent 50
// receipts.
export async function getBrandRestockHistoryAction(brand: string | null): Promise<RestockHistoryRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();

  let productQuery = supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", profile.shopId)
    .eq("category", "ejuice")
    .eq("archived", false);
  productQuery = brand ? productQuery.eq("brand", brand) : productQuery.is("brand", null);
  const { data: products } = await productQuery;
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const productIds = [...productNameById.keys()];
  if (productIds.length === 0) return [];

  const { data: variantRows } = await supabase
    .from("variants")
    .select("id, nicotine_mg, product_id")
    .in("product_id", productIds);
  const variantInfoById = new Map(
    (variantRows ?? []).map((v) => [
      v.id as string,
      { flavor: productNameById.get(v.product_id as string) ?? "Unknown flavor", nicotineMg: v.nicotine_mg as number | null },
    ]),
  );
  const variantIds = [...variantInfoById.keys()];
  if (variantIds.length === 0) return [];

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("received_at, quantity_added, variant_id, profiles!stock_receipts_received_by_fkey(display_name)")
    .eq("shop_id", profile.shopId)
    .in("variant_id", variantIds)
    .order("received_at", { ascending: false })
    .limit(50);

  return (receipts ?? []).map((r) => {
    const info = variantInfoById.get(r.variant_id as string);
    const receivedBy = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      date: r.received_at as string,
      label: info ? `${info.flavor}${info.nicotineMg != null ? ` · ${info.nicotineMg}mg` : ""}` : "Unknown flavor",
      quantity: r.quantity_added as number,
      receivedByName: (receivedBy?.display_name as string | undefined) ?? null,
    };
  });
}

// Accessory counterpart -- scoped to one product's own variants (e.g. every
// color of a Device), matching getProductLastRestocked's per-product scope
// in inventory-list.tsx rather than the brand-wide scope above.
export async function getProductRestockHistoryAction(productId: string): Promise<RestockHistoryRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();

  const { data: variantRows } = await supabase
    .from("variants")
    .select("id, size, for_device, ohms")
    .eq("shop_id", profile.shopId)
    .eq("product_id", productId);
  const variantInfoById = new Map(
    (variantRows ?? []).map((v) => [
      v.id as string,
      variantLabel(v),
    ]),
  );
  const variantIds = [...variantInfoById.keys()];
  if (variantIds.length === 0) return [];

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("received_at, quantity_added, variant_id, profiles!stock_receipts_received_by_fkey(display_name)")
    .eq("shop_id", profile.shopId)
    .in("variant_id", variantIds)
    .order("received_at", { ascending: false })
    .limit(50);

  return (receipts ?? []).map((r) => {
    const receivedBy = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      date: r.received_at as string,
      label: variantInfoById.get(r.variant_id as string) ?? "Default",
      quantity: r.quantity_added as number,
      receivedByName: (receivedBy?.display_name as string | undefined) ?? null,
    };
  });
}

export async function archiveProductAction(productId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ archived: true })
    .eq("id", productId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  redirect("/inventory");
}

const flavorBatchSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  size: z.string().optional(),
  supplier: z.string().optional(),
  nicotineLevels: z
    .string()
    .transform((s) => s.split(",").map(Number).filter((n) => Number.isFinite(n)))
    .refine((arr) => arr.length > 0, "Select at least one nicotine level"),
});

export async function createFlavorBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = flavorBatchSchema.safeParse({
    brand: formData.get("brand") ?? "",
    size: formData.get("size") ?? "",
    supplier: formData.get("supplier") ?? "",
    nicotineLevels: formData.get("nicotineLevels") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { brand, size, supplier, nicotineLevels } = parsed.data;

  const levels = nicotineLevels.map((mg) => {
    const flavors = String(formData.get(`flavors-${mg}`) ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const cost = Number(formData.get(`cost-${mg}`) ?? 0) || 0;
    const price = Number(formData.get(`price-${mg}`) ?? 0) || 0;
    return { mg, flavors, cost, price };
  });

  const emptyLevel = levels.find((l) => l.flavors.length === 0);
  if (emptyLevel) {
    return { error: `Add at least one flavor for ${emptyLevel.mg}mg` };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  const shopId = profile.shopId;

  const resolvedSupplier = await resolveSupplierId(supabase, shopId, supplier);
  if (resolvedSupplier.error) return { error: resolvedSupplier.error };
  const supplierId = resolvedSupplier.id;

  // Reuse an existing product for any flavor name that already exists under this
  // brand, instead of creating a second, visually-duplicate product card. Only
  // newly-created products get the supplier set — existing ones keep their own.
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("category", "ejuice")
    .eq("archived", false)
    .eq("brand", brand);
  const productIdByName = new Map(
    (existingProducts ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );

  const allFlavorNames = [...new Set(levels.flatMap((l) => l.flavors))];
  const newNames = allFlavorNames.filter((name) => !productIdByName.has(name.trim().toLowerCase()));
  if (newNames.length > 0) {
    const { data: inserted, error: productsError } = await supabase
      .from("products")
      .insert(
        newNames.map((name) => ({
          shop_id: shopId,
          name,
          brand,
          category: "ejuice" as const,
          supplier_id: supplierId,
        })),
      )
      .select("id");
    if (productsError) return { error: productsError.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  const productIds = [...new Set(allFlavorNames.map((name) => productIdByName.get(name.trim().toLowerCase())!))];
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
  }[] = [];
  for (const { mg, flavors, cost, price } of levels) {
    const effectiveCost = profile.role === "owner" ? cost : 0;
    for (const name of flavors) {
      const productId = productIdByName.get(name.trim().toLowerCase())!;
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

const flavorPodBatchSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  forDevice: z.string().optional(),
  flavors: z
    .string()
    .transform((text) => text.split("\n").map((f) => f.trim()).filter(Boolean)),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
});

// Flavor Pods get their own flow (brand + flavors, mirroring Add E-juice)
// rather than the generic accessory batch form -- there's no nicotine-level
// split to worry about (a pod line only ever comes in one strength), so it's
// simpler than e-juice: one cost/price/flavor-list per brand+device, not
// repeated per anything.
export async function createFlavorPodBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = flavorPodBatchSchema.safeParse({
    brand: formData.get("brand") ?? "",
    forDevice: formData.get("forDevice") ?? "",
    flavors: formData.get("flavors") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { brand, forDevice, flavors, cost, price } = parsed.data;
  if (flavors.length === 0) {
    return { error: "Add at least one flavor" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  const shopId = profile.shopId;
  const effectiveCost = profile.role === "owner" ? cost : 0;
  const deviceValue = forDevice?.trim() || null;

  // Reuse an existing product for any flavor name that already exists under
  // this brand, instead of creating a second, visually-duplicate product card.
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("category", "Flavor Pod")
    .eq("archived", false)
    .eq("brand", brand);
  const productIdByName = new Map(
    (existingProducts ?? []).map((p) => [p.name.trim().toLowerCase(), p.id as string]),
  );

  const uniqueFlavors = [...new Set(flavors)];
  const newNames = uniqueFlavors.filter((name) => !productIdByName.has(name.trim().toLowerCase()));
  if (newNames.length > 0) {
    const { data: inserted, error: productsError } = await supabase
      .from("products")
      .insert(
        newNames.map((name) => ({
          shop_id: shopId,
          name,
          brand,
          category: "Flavor Pod" as const,
        })),
      )
      .select("id");
    if (productsError) return { error: productsError.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  const productIds = [...new Set(uniqueFlavors.map((name) => productIdByName.get(name.trim().toLowerCase())!))];
  const { data: existingVariants } = productIds.length
    ? await supabase.from("variants").select("product_id, for_device").in("product_id", productIds)
    : { data: [] as { product_id: string; for_device: string | null }[] };
  const seenVariantKeys = new Set(
    (existingVariants ?? []).map((v) => `${v.product_id}|${v.for_device ?? ""}`),
  );

  const variantRows: {
    shop_id: string;
    product_id: string;
    flavor: string;
    for_device: string | null;
    cost: number;
    price: number;
  }[] = [];
  for (const name of uniqueFlavors) {
    const productId = productIdByName.get(name.trim().toLowerCase())!;
    const key = `${productId}|${deviceValue ?? ""}`;
    if (seenVariantKeys.has(key)) continue;
    seenVariantKeys.add(key);
    variantRows.push({
      shop_id: shopId,
      product_id: productId,
      flavor: name,
      for_device: deviceValue,
      cost: effectiveCost,
      price,
    });
  }

  if (variantRows.length > 0) {
    const { error: variantsError } = await supabase.from("variants").insert(variantRows);
    if (variantsError) return { error: variantsError.message };
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

const categoryBatchSchema = z.object({
  categoryKey: z.string().min(1),
  brand: z.string().optional(),
  items: z.array(z.string()).transform((arr) => arr.map((f) => f.trim()).filter(Boolean)),
  variantOptions: z.array(z.string()).optional().default([]),
  variantOptionsText: z.string().optional(),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  lowStockThreshold: z.coerce.number().int().nonnegative(),
});

export async function createCategoryBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = categoryBatchSchema.safeParse({
    categoryKey: formData.get("categoryKey"),
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
    categoryKey,
    brand,
    items,
    variantOptions,
    variantOptionsText,
    cost,
    price,
    lowStockThreshold,
  } = parsed.data;
  if (items.length === 0) {
    return { error: `Add at least one ${categoryKey === "cotton" || categoryKey === "other" ? "product" : "item"}` };
  }

  const category = getProductCategory(categoryKey);
  if (!category) {
    return { error: "Invalid category" };
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };
  const shopId = profile.shopId;
  const effectiveCost = profile.role === "owner" ? cost : 0;

  const productNames = items.map((item) => category.nameTemplate(item));

  // Reuse an existing product for any item name that already exists under this
  // brand/category, instead of creating a second, visually-duplicate card.
  let existingQuery = supabase
    .from("products")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("category", category.dbCategory)
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
          category: category.dbCategory,
        })),
      )
      .select("id");
    if (productsError) return { error: productsError.message };
    newNames.forEach((name, i) => productIdByName.set(name.trim().toLowerCase(), inserted[i].id));
  }

  let levels: (string | null)[];
  if (category.variantDimension?.inputType === "freeText") {
    levels = [...new Set((variantOptionsText ?? "").split(",").map((v) => v.trim()).filter(Boolean))];
  } else if (category.variantDimension) {
    levels = variantOptions;
  } else {
    levels = [null];
  }
  if (category.variantDimension && levels.length === 0) {
    const verb = category.variantDimension.inputType === "freeText" ? "Add" : "Select";
    return { error: `${verb} at least one ${category.variantDimension.label.toLowerCase()}` };
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
    const forDevice = category.setForDevice ? item : null;
    for (const level of levels) {
      const ohms = category.variantDimension?.field === "ohms" && level ? Number(level) : null;
      const size =
        category.variantDimension?.field === "size" && level
          ? (category.variantDimension.formatValue?.(level) ?? level)
          : null;
      const flavor =
        category.variantDimension?.field === "flavor" && level
          ? (category.variantDimension.formatValue?.(level) ?? level)
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

export async function deleteVariantAction(variantId: string, productId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("variants")
    .delete()
    .eq("id", variantId)
    .eq("shop_id", profile.shopId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/inventory");
  return {};
}
