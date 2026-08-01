type ShopSaleFields = {
  saleEnabled: boolean;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
};

/**
 * Mirrors the boolean record_sale computes server-side at transaction time
 * (supabase/migrations/0031_sale_promo.sql) -- this copy is for the Sell
 * screen's live preview / input-gating only. The RPC re-derives the same
 * three conditions itself and is the actual source of truth.
 */
export function isSaleActive(shop: ShopSaleFields): boolean {
  if (!shop.saleEnabled) return false;
  const now = Date.now();
  if (shop.saleStartsAt && now < new Date(shop.saleStartsAt).getTime()) return false;
  if (shop.saleEndsAt && now > new Date(shop.saleEndsAt).getTime()) return false;
  return true;
}
