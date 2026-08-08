"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { variantLabel } from "@/lib/variant-label";
import { getProductCategory } from "@/lib/inventory/product-categories";
import { getCustomCategoryConfig } from "@/lib/inventory/custom-categories";

export type ActionResult = { error?: string };
export type ActionState = { error?: string };

export type BranchCatalogItem = { id: string; label: string; stockQty: number };

// Lets the owner browse a specific branch's catalog from the Admin
// Overview page (for the branch-to-branch transfer picker below) without
// switching into that branch first -- lazy-fetched per selection rather
// than preloading every branch's full catalog up front.
export async function fetchBranchInventoryAction(shopId: string): Promise<BranchCatalogItem[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  if (!profile.shops.some((s) => s.shopId === shopId && s.role === "owner")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("variants")
    .select("id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, products(name, brand, archived)")
    .eq("shop_id", shopId);

  return (data ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      const detail = variantLabel({
        flavor: v.flavor as string | null,
        nicotine_mg: v.nicotine_mg as number | null,
        size: v.size as string | null,
        for_device: v.for_device as string | null,
        ohms: v.ohms as number | null,
      });
      const base = product.brand ? `${product.brand as string} — ${product.name as string}` : (product.name as string);
      return {
        id: v.id as string,
        label: detail === "Default" ? base : `${base} — ${detail}`,
        stockQty: v.stock_qty as number,
      };
    })
    .filter((v): v is BranchCatalogItem => v !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function addFloatingStockAction(input: {
  category: string;
  brand: string | null;
  productName: string;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
  sku: string | null;
  quantity: number;
  cost: number | null;
  price: number | null;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage floating inventory" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_floating_stock", {
    p_category: input.category,
    p_brand: input.brand,
    p_product_name: input.productName,
    p_flavor: input.flavor,
    p_nicotine_mg: input.nicotineMg,
    p_size: input.size,
    p_for_device: input.forDevice,
    p_ohms: input.ohms,
    p_sku: input.sku,
    p_quantity: input.quantity,
    p_cost: input.cost,
    p_price: input.price,
  });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  return {};
}

export type TransferLineInput = { variantId?: string; floatingVariantId?: string; sentQty: number };

// Covers both directions (floating -> branch, or a branch -> floating
// pull-back) since source/destination are just parameters to the RPC.
// Used from both /floating-inventory (owner) and the branch's own
// /inventory page (owner-only "Send to floating inventory") -- imported
// directly rather than duplicated as a thin per-page wrapper, since
// unlike the cash-transfer actions this doesn't need an extra
// caller-supplied shopId: the RPC already resolves everything from its
// own explicit source/destination parameters.
export async function createInventoryTransferAction(
  sourceType: "branch" | "floating",
  sourceShopId: string | null,
  destinationType: "branch" | "floating",
  destinationShopId: string | null,
  lines: TransferLineInput[],
  note: string | null,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can move inventory between branches" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_inventory_transfer", {
    p_source_type: sourceType,
    p_source_shop_id: sourceShopId,
    p_destination_type: destinationType,
    p_destination_shop_id: destinationShopId,
    p_lines: lines.map((l) => ({
      variant_id: l.variantId ?? null,
      floating_variant_id: l.floatingVariantId ?? null,
      sent_qty: l.sentQty,
    })),
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

// Recording a counted quantity per line is a plain RLS-gated write, not
// an RPC -- same reasoning stock_audit_lines.counted_qty is
// member-writable (recording a count isn't a trust decision). Saved
// per-line as the checklist is worked through, so it's resumable.
export async function saveTransferLineCountAction(
  lineId: string,
  receivedQty: number | null,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_transfer_lines")
    .update({ received_qty: receivedQty })
    .eq("id", lineId);
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

export async function receiveInventoryTransferAction(transferId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_inventory_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

export async function cancelInventoryTransferAction(transferId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_inventory_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

// Owner-only decision on a shortfall flagged during receipt: send the
// missing units back to wherever the transfer originated, or leave them
// in the floating pool where receive_inventory_transfer already put them.
export async function resolveShortfallAction(
  shortfallId: string,
  action: "return_to_source" | "keep_in_floating",
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can resolve a flagged shortfall" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_inventory_transfer_shortfall", {
    p_shortfall_id: shortfallId,
    p_action: action,
  });
  if (error) return { error: error.message };

  revalidatePath("/floating-inventory");
  revalidatePath("/inventory");
  return {};
}

// ---------------------------------------------------------------------
// Batch-creation flows for /floating-inventory/new -- the floating-pool
// equivalent of the branch-level batch actions in inventory/actions.ts.
// Those write directly via .insert() because products/variants have
// member-writable RLS; floating_products/floating_variants don't (every
// write already goes through add_floating_stock), so these compute the
// same deduped set of combinations and call add_floating_stock once per
// unique one instead -- it already does its own case-insensitive
// find-or-create per call, so no separate product-lookup step is needed
// here the way the branch versions need one. add_floating_stock requires
// a positive quantity, so unlike the branch batches (which start variants
// at 0 stock), these carry one shared required "quantity" field applied
// to every combination created -- there's no separate "receive stock"
// step for floating variants today.
// ---------------------------------------------------------------------

const floatingFlavorBatchSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  size: z.string().optional(),
  quantity: z.coerce.number().int().positive("Enter a positive quantity"),
  nicotineLevels: z
    .string()
    .transform((s) => s.split(",").map(Number).filter((n) => Number.isFinite(n)))
    .refine((arr) => arr.length > 0, "Select at least one nicotine level"),
});

export async function createFloatingFlavorBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = floatingFlavorBatchSchema.safeParse({
    brand: formData.get("brand") ?? "",
    size: formData.get("size") ?? "",
    quantity: formData.get("quantity") || 0,
    nicotineLevels: formData.get("nicotineLevels") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { brand, size, quantity, nicotineLevels } = parsed.data;

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

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage floating inventory" };

  const supabase = await createClient();
  const seenKeys = new Set<string>();
  for (const { mg, flavors, cost, price } of levels) {
    for (const name of flavors) {
      const key = `${name.trim().toLowerCase()}|${mg}|${size || ""}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const { error } = await supabase.rpc("add_floating_stock", {
        p_category: "ejuice",
        p_brand: brand,
        p_product_name: name,
        p_flavor: name,
        p_nicotine_mg: mg,
        p_size: size || null,
        p_for_device: null,
        p_ohms: null,
        p_sku: null,
        p_quantity: quantity,
        p_cost: cost,
        p_price: price,
      });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/floating-inventory");
  redirect("/floating-inventory");
}

const floatingFlavorPodBatchSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  forDevice: z.string().optional(),
  quantity: z.coerce.number().int().positive("Enter a positive quantity"),
  flavors: z
    .string()
    .transform((text) => text.split("\n").map((f) => f.trim()).filter(Boolean)),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
});

export async function createFloatingFlavorPodBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = floatingFlavorPodBatchSchema.safeParse({
    brand: formData.get("brand") ?? "",
    forDevice: formData.get("forDevice") ?? "",
    quantity: formData.get("quantity") || 0,
    flavors: formData.get("flavors") ?? "",
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { brand, forDevice, quantity, flavors, cost, price } = parsed.data;
  if (flavors.length === 0) {
    return { error: "Add at least one flavor" };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage floating inventory" };

  const supabase = await createClient();
  const deviceValue = forDevice?.trim() || null;
  const uniqueFlavors = [...new Set(flavors)];

  for (const name of uniqueFlavors) {
    const { error } = await supabase.rpc("add_floating_stock", {
      p_category: "Flavor Pod",
      p_brand: brand,
      p_product_name: name,
      p_flavor: name,
      p_nicotine_mg: null,
      p_size: null,
      p_for_device: deviceValue,
      p_ohms: null,
      p_sku: null,
      p_quantity: quantity,
      p_cost: cost,
      p_price: price,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/floating-inventory");
  redirect("/floating-inventory");
}

const floatingCategoryBatchSchema = z.object({
  categoryKey: z.string().min(1),
  brand: z.string().optional(),
  items: z.array(z.string()).transform((arr) => arr.map((f) => f.trim()).filter(Boolean)),
  variantOptions: z.array(z.string()).optional().default([]),
  variantOptionsText: z.string().optional(),
  variantOptions2: z.array(z.string()).optional().default([]),
  variantOptionsText2: z.string().optional(),
  quantity: z.coerce.number().int().positive("Enter a positive quantity"),
  cost: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
});

export async function createFloatingCategoryBatchAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = floatingCategoryBatchSchema.safeParse({
    categoryKey: formData.get("categoryKey"),
    brand: formData.get("brand") ?? "",
    items: formData.getAll("items"),
    variantOptions: formData.getAll("variantOptions"),
    variantOptionsText: formData.get("variantOptionsText") ?? "",
    variantOptions2: formData.getAll("variantOptions2"),
    variantOptionsText2: formData.get("variantOptionsText2") ?? "",
    quantity: formData.get("quantity") || 0,
    cost: formData.get("cost") || 0,
    price: formData.get("price") || 0,
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
    variantOptions2,
    variantOptionsText2,
    quantity,
    cost,
    price,
  } = parsed.data;

  const supabase = await createClient();
  const category = getProductCategory(categoryKey) ?? (await getCustomCategoryConfig(supabase, categoryKey));
  if (!category) return { error: "Invalid category" };
  if (items.length === 0) {
    return { error: `Add at least one ${category.setForDevice ? "item" : "product"}` };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only owners can manage floating inventory" };

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

  let levels2: (string | null)[];
  if (category.variantDimension2?.inputType === "freeText") {
    levels2 = [...new Set((variantOptionsText2 ?? "").split(",").map((v) => v.trim()).filter(Boolean))];
  } else if (category.variantDimension2) {
    levels2 = variantOptions2;
  } else {
    levels2 = [null];
  }
  if (category.variantDimension2 && levels2.length === 0) {
    const verb = category.variantDimension2.inputType === "freeText" ? "Add" : "Select";
    return { error: `${verb} at least one ${category.variantDimension2.label.toLowerCase()}` };
  }

  const seenKeys = new Set<string>();
  for (const item of items) {
    const productName = category.nameTemplate(item);
    const forDevice = category.setForDevice ? item : null;
    for (const level of levels) {
      for (const level2 of levels2) {
        const ohms =
          (category.variantDimension?.field === "ohms" && level) ||
          (category.variantDimension2?.field === "ohms" && level2)
            ? Number(category.variantDimension?.field === "ohms" ? level : level2)
            : null;
        const size =
          category.variantDimension?.field === "size" && level
            ? (category.variantDimension.formatValue?.(level) ?? level)
            : category.variantDimension2?.field === "size" && level2
              ? (category.variantDimension2.formatValue?.(level2) ?? level2)
              : null;
        const flavor =
          category.variantDimension?.field === "flavor" && level
            ? (category.variantDimension.formatValue?.(level) ?? level)
            : category.variantDimension2?.field === "flavor" && level2
              ? (category.variantDimension2.formatValue?.(level2) ?? level2)
              : null;
        const key = `${productName.trim().toLowerCase()}|${ohms ?? ""}|${size ?? ""}|${flavor ?? ""}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const { error } = await supabase.rpc("add_floating_stock", {
          p_category: category.dbCategory,
          p_brand: brand || null,
          p_product_name: productName,
          p_flavor: flavor,
          p_nicotine_mg: null,
          p_size: size,
          p_for_device: forDevice,
          p_ohms: ohms,
          p_sku: null,
          p_quantity: quantity,
          p_cost: cost,
          p_price: price,
        });
        if (error) return { error: error.message };
      }
    }
  }

  revalidatePath("/floating-inventory");
  redirect("/floating-inventory");
}
