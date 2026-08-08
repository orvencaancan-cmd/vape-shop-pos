import type { createClient } from "@/lib/supabase/server";
import { PRODUCT_CATEGORIES, type ProductCategoryConfig } from "./product-categories";

// Built-in categories (Cartridge, Flavor Pod, Device, Pod Device, Wire,
// Cotton) have no DB row of their own -- archiving one is tracked as a
// per-owner "hide this key" marker instead, mirroring how
// custom_categories.archived already hides a custom category everywhere
// its list gets built.
export async function fetchVisibleBuiltinCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ProductCategoryConfig[]> {
  const { data } = await supabase.from("archived_builtin_categories").select("category_key");
  const archivedKeys = new Set((data ?? []).map((r) => r.category_key as string));
  return PRODUCT_CATEGORIES.filter((c) => !archivedKeys.has(c.key));
}
