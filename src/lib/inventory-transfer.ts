import type { createClient } from "@/lib/supabase/server";

export type FloatingVariant = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  subcategory: string | null;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
  sku: string | null;
  cost: number;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
};

// Mirrors how sell/page.tsx and inventory/page.tsx already fetch a shop's
// variants -- same shape, just keyed by owner_user_id (via RLS) instead of
// shop_id. Archived floating products are filtered out client-side, same
// convention the shop-side Inventory page uses.
export async function fetchFloatingCatalog(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<FloatingVariant[]> {
  const { data } = await supabase
    .from("floating_variants")
    .select(
      "id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty, low_stock_threshold, floating_products(name, brand, category, subcategory, archived)",
    )
    .order("created_at");

  return (data ?? [])
    .map((v) => {
      const product = Array.isArray(v.floating_products) ? v.floating_products[0] : v.floating_products;
      if (!product || product.archived) return null;
      return {
        id: v.id as string,
        productId: v.product_id as string,
        productName: product.name as string,
        brand: (product.brand as string | null) ?? null,
        category: product.category as "ejuice" | "accessory",
        subcategory: (product.subcategory as string | null) ?? null,
        flavor: v.flavor as string | null,
        nicotineMg: v.nicotine_mg != null ? Number(v.nicotine_mg) : null,
        size: v.size as string | null,
        forDevice: v.for_device as string | null,
        ohms: v.ohms != null ? Number(v.ohms) : null,
        sku: v.sku as string | null,
        cost: Number(v.cost),
        price: Number(v.price),
        stockQty: v.stock_qty as number,
        lowStockThreshold: v.low_stock_threshold as number,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

export type PendingInventoryTransferLine = {
  id: string;
  productName: string;
  brand: string | null;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
  sentQty: number;
  receivedQty: number | null;
};

export type PendingInventoryTransfer = {
  id: string;
  sourceType: "branch" | "floating";
  sourceShopId: string | null;
  sourceShopName: string | null;
  destinationType: "branch" | "floating";
  destinationShopId: string | null;
  destinationShopName: string | null;
  note: string | null;
  createdAt: string;
  initiatedByName: string | null;
  lines: PendingInventoryTransferLine[];
};

// RLS already limits this to transfers touching a shop the caller belongs
// to (or that they personally initiated) -- see inventory_transfers_select
// in 0045_floating_inventory.sql -- so a single unfiltered query is safe;
// callers slice it into "incoming to X" / "outgoing from X" themselves,
// same pattern as fetchPendingTransfers in cash-flow.ts.
export async function fetchPendingInventoryTransfers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PendingInventoryTransfer[]> {
  const { data } = await supabase
    .from("inventory_transfers")
    .select(
      "id, source_type, source_shop_id, destination_type, destination_shop_id, note, created_at, source_shop:source_shop_id(name), destination_shop:destination_shop_id(name), initiator:initiated_by(display_name), inventory_transfer_lines(id, product_name, brand, flavor, nicotine_mg, size, for_device, ohms, sent_qty, received_qty)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => {
    const sourceShop = Array.isArray(t.source_shop) ? t.source_shop[0] : t.source_shop;
    const destinationShop = Array.isArray(t.destination_shop) ? t.destination_shop[0] : t.destination_shop;
    const initiator = Array.isArray(t.initiator) ? t.initiator[0] : t.initiator;
    const lines = (t.inventory_transfer_lines ?? []) as Record<string, unknown>[];
    return {
      id: t.id as string,
      sourceType: t.source_type as "branch" | "floating",
      sourceShopId: t.source_shop_id as string | null,
      sourceShopName: (sourceShop?.name as string | null) ?? null,
      destinationType: t.destination_type as "branch" | "floating",
      destinationShopId: t.destination_shop_id as string | null,
      destinationShopName: (destinationShop?.name as string | null) ?? null,
      note: t.note as string | null,
      createdAt: t.created_at as string,
      initiatedByName: (initiator?.display_name as string | null) ?? null,
      lines: lines.map((l) => ({
        id: l.id as string,
        productName: l.product_name as string,
        brand: l.brand as string | null,
        flavor: l.flavor as string | null,
        nicotineMg: l.nicotine_mg != null ? Number(l.nicotine_mg) : null,
        size: l.size as string | null,
        forDevice: l.for_device as string | null,
        ohms: l.ohms != null ? Number(l.ohms) : null,
        sentQty: l.sent_qty as number,
        receivedQty: l.received_qty != null ? Number(l.received_qty) : null,
      })),
    };
  });
}
