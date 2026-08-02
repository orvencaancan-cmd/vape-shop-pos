import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { isSaleActive } from "@/lib/sale-status";

const BADGE = "inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-white";

export default async function PromosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select(
      "loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent, sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at",
    )
    .eq("id", profile.shopId)
    .single();

  const loyaltyActive = (shop?.loyalty_earn_enabled ?? false) || (shop?.loyalty_redeem_enabled ?? false);
  const saleActive = isSaleActive({
    saleEnabled: shop?.sale_enabled ?? false,
    saleStartsAt: shop?.sale_starts_at ?? null,
    saleEndsAt: shop?.sale_ends_at ?? null,
  });

  let saleItemCount: number | null = null;
  if (saleActive && shop?.sale_scope === "items") {
    const { count } = await supabase
      .from("sale_promo_products")
      .select("product_id", { count: "exact", head: true })
      .eq("shop_id", profile.shopId);
    saleItemCount = count ?? 0;
  }

  const hasAnyPromo = loyaltyActive || saleActive;

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Promos</h1>

      {!hasAnyPromo ? (
        <p className="mt-6 text-sm text-muted">No Promo Active</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {loyaltyActive && (
            <div className="rounded-lg border border-hairline bg-canvas-soft p-4">
              <span className={BADGE}>Loyalty Promo</span>
              <p className="mt-2 text-sm text-ink">
                {shop?.loyalty_earn_enabled
                  ? `Customers earn ${Number(shop.loyalty_reward_percent ?? 0)}% of their purchase back as store credit.`
                  : "Store credit can't be earned right now."}
              </p>
              <p className="mt-1 text-sm text-muted">
                {shop?.loyalty_redeem_enabled
                  ? "Redeeming store credit is accepted at this branch."
                  : "This branch doesn't accept store-credit redemptions right now."}
              </p>
            </div>
          )}

          {saleActive && (
            <div className="rounded-lg border border-hairline bg-canvas-soft p-4">
              <span className={BADGE}>Discount Promo</span>
              <p className="mt-2 text-sm text-ink">
                {Number(shop?.sale_percent ?? 0)}% off{" "}
                {shop?.sale_scope === "items"
                  ? `on ${saleItemCount} selected product${saleItemCount === 1 ? "" : "s"}`
                  : "on everything"}
                . Applied automatically at checkout — no action needed.
              </p>
              {shop?.sale_ends_at && (
                <p className="mt-1 text-sm text-muted">
                  Ends {new Date(shop.sale_ends_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
