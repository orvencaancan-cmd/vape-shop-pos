import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { LoyaltyForm } from "./loyalty-form";
import { SaleForm } from "./sale-form";
import { AdminPromosList } from "./admin-promos-list";

export default async function PromosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  if (profile.inAdminOverview) {
    const activeOwnedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    return <AdminPromosList ownedShops={activeOwnedShops} />;
  }
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select(
      "loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent, sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at",
    )
    .eq("id", profile.shopId)
    .single();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand")
    .eq("shop_id", profile.shopId)
    .eq("archived", false)
    .order("name");

  const { data: saleProductRows } = await supabase
    .from("sale_promo_products")
    .select("product_id")
    .eq("shop_id", profile.shopId);

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Promos</h1>
      <p className="mt-1 text-sm text-muted">
        Loyalty: customers earn store credit here based on what they spend, redeemable on a
        future purchase at any of your branches that accepts redemptions.
      </p>

      <div className="mt-6 rounded-lg border border-hairline bg-canvas-soft p-4">
        <LoyaltyForm
          shopId={profile.shopId}
          earnEnabled={shop?.loyalty_earn_enabled ?? false}
          redeemEnabled={shop?.loyalty_redeem_enabled ?? false}
          rewardPercent={Number(shop?.loyalty_reward_percent ?? 0)}
        />
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase text-muted">Sale</h2>
      <p className="mt-1 text-sm text-muted">
        Automatically discounts checkout — either the whole branch or specific products — with no
        cashier action needed. Only one promo can apply to a sale at a time, so an active Sale
        pauses Loyalty and the manual staff discount for the duration.
      </p>
      <div className="mt-3 rounded-lg border border-hairline bg-canvas-soft p-4">
        <SaleForm
          shopId={profile.shopId}
          enabled={shop?.sale_enabled ?? false}
          percent={Number(shop?.sale_percent ?? 0)}
          scope={(shop?.sale_scope as "branch" | "items") ?? "branch"}
          startsAt={shop?.sale_starts_at ?? null}
          endsAt={shop?.sale_ends_at ?? null}
          products={products ?? []}
          selectedProductIds={(saleProductRows ?? []).map((r) => r.product_id)}
        />
      </div>
    </main>
  );
}
