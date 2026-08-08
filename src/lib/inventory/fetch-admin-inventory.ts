import type { createClient } from "@/lib/supabase/server";
import type { ShopMembership } from "@/lib/auth/get-current-profile";
import { variantLabel } from "@/lib/variant-label";

export type AdminInventoryItem = {
  key: string;
  brand: string | null;
  category: string;
  productName: string;
  detail: string;
  stockByShop: Record<string, number>;
  lowByShop: Record<string, boolean>;
};

// Combines every owned branch's own products/variants into one list for the
// owner's Admin Overview -- branches are independent tenants of
// products/variants (no shared id to join on), so the same item across
// branches is matched by name the same case-insensitive way the batch-add
// flows in inventory/actions.ts already dedupe within one branch.
export async function fetchAdminInventory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownedShops: ShopMembership[],
): Promise<AdminInventoryItem[]> {
  const perShop = await Promise.all(
    ownedShops.map(async (s) => {
      const { data } = await supabase
        .from("variants")
        .select(
          "flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, products(name, brand, category, archived)",
        )
        .eq("shop_id", s.shopId);
      return { shopId: s.shopId, rows: data ?? [] };
    }),
  );

  const items = new Map<string, AdminInventoryItem>();
  for (const { shopId, rows } of perShop) {
    for (const v of rows) {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) continue;

      const detail = variantLabel({
        flavor: v.flavor as string | null,
        nicotine_mg: v.nicotine_mg as number | null,
        size: v.size as string | null,
        for_device: v.for_device as string | null,
        ohms: v.ohms != null ? Number(v.ohms) : null,
      });
      const brand = (product.brand as string | null) ?? null;
      const productName = product.name as string;
      const category = product.category as string;
      const key = `${(brand ?? "").trim().toLowerCase()}|${productName.trim().toLowerCase()}|${category.toLowerCase()}|${detail.toLowerCase()}`;

      if (!items.has(key)) {
        items.set(key, { key, brand, category, productName, detail, stockByShop: {}, lowByShop: {} });
      }
      const item = items.get(key)!;
      const qty = v.stock_qty as number;
      item.stockByShop[shopId] = (item.stockByShop[shopId] ?? 0) + qty;
      item.lowByShop[shopId] = qty <= (v.low_stock_threshold as number);
    }
  }

  return [...items.values()];
}
