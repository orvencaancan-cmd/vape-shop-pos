import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LoyaltyForm } from "./loyalty-form";
import { SaleForm } from "./sale-form";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminPromosList({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const shopIds = ownedShops.map((s) => s.shopId);
  const { data: shops } = await supabase
    .from("shops")
    .select(
      "id, loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent, sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at",
    )
    .in("id", shopIds);

  const { data: products } = await supabase
    .from("products")
    .select("id, shop_id, name, brand")
    .in("shop_id", shopIds)
    .eq("archived", false)
    .order("name");

  const { data: saleProductRows } = await supabase
    .from("sale_promo_products")
    .select("shop_id, product_id")
    .in("shop_id", shopIds);

  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));
  const productsByShop = new Map<string, { id: string; name: string; brand: string | null }[]>();
  for (const p of products ?? []) {
    if (!productsByShop.has(p.shop_id)) productsByShop.set(p.shop_id, []);
    productsByShop.get(p.shop_id)!.push({ id: p.id, name: p.name, brand: p.brand });
  }
  const saleProductIdsByShop = new Map<string, string[]>();
  for (const r of saleProductRows ?? []) {
    if (!saleProductIdsByShop.has(r.shop_id)) saleProductIdsByShop.set(r.shop_id, []);
    saleProductIdsByShop.get(r.shop_id)!.push(r.product_id);
  }

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Promos</h1>
      <p className="mt-1 text-sm text-muted">
        Loyalty Promo: customers earn store credit based on what they spend, redeemable at any of
        your branches that accepts redemptions. Discount Promo: automatically discounts checkout
        with no cashier action. Only one promo can apply to a sale at a time. Each branch sets its
        own participation.
      </p>
      <Link
        href="/settings/customers"
        className="mt-2 inline-block text-xs text-muted underline underline-offset-2 hover:text-ink"
      >
        View customer list →
      </Link>

      <div className="stagger mt-6 flex flex-col gap-3">
        {ownedShops.map((s) => {
          const shop = shopById.get(s.shopId);
          return (
            <div
              key={s.shopId}
              className="rounded-lg border border-hairline bg-canvas-soft p-4"
            >
              <p className="text-sm font-medium text-ink">{s.shopName}</p>
              <p className="mt-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Loyalty Promo
              </p>
              <div className="mt-2">
                <LoyaltyForm
                  shopId={s.shopId}
                  earnEnabled={shop?.loyalty_earn_enabled ?? false}
                  redeemEnabled={shop?.loyalty_redeem_enabled ?? false}
                  rewardPercent={Number(shop?.loyalty_reward_percent ?? 0)}
                />
              </div>
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Discount Promo
                </p>
                <div className="mt-2">
                  <SaleForm
                    shopId={s.shopId}
                    enabled={shop?.sale_enabled ?? false}
                    percent={Number(shop?.sale_percent ?? 0)}
                    scope={(shop?.sale_scope as "branch" | "items") ?? "branch"}
                    startsAt={shop?.sale_starts_at ?? null}
                    endsAt={shop?.sale_ends_at ?? null}
                    products={productsByShop.get(s.shopId) ?? []}
                    selectedProductIds={saleProductIdsByShop.get(s.shopId) ?? []}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
