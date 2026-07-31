import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/billing-status";
import { TIER_AMOUNTS } from "@/lib/manual-payment";
import { RatesPopup } from "@/components/rates-popup";
import { ManualPaymentPanel } from "./manual-payment-panel";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminBillingList({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const shopIds = ownedShops.map((s) => s.shopId);
  const [{ data: shops }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, subscription_status, trial_ends_at, current_period_end, billing_tier")
      .in("id", shopIds),
    supabase
      .from("manual_payment_requests")
      .select("shop_id")
      .in("shop_id", shopIds)
      .eq("status", "pending"),
  ]);

  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));
  const pendingShopIds = new Set((pendingRequests ?? []).map((r) => r.shop_id));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading text-2xl">Billing</h1>
        <RatesPopup amounts={TIER_AMOUNTS} />
      </div>
      <p className="mt-1 text-sm text-muted">
        Each branch keeps its own subscription. Bundled multi-branch pricing is coming soon.
      </p>

      <div className="stagger mt-6 flex flex-col gap-3">
        {ownedShops.map((s) => {
          const shop = shopById.get(s.shopId);
          const amount = TIER_AMOUNTS[(shop?.billing_tier as "primary" | "additional") ?? "primary"];
          return (
            <div
              key={s.shopId}
              className="rounded-lg border border-hairline bg-canvas-soft p-4"
            >
              <div>
                <p className="text-sm font-medium text-ink">{s.shopName}</p>
                <p className="text-xs text-muted">
                  {shop
                    ? statusLabel({
                        subscriptionStatus: shop.subscription_status,
                        trialEndsAt: shop.trial_ends_at,
                        currentPeriodEnd: shop.current_period_end,
                      })
                    : "—"}
                  {shop?.subscription_status === "trialing" && shop.trial_ends_at && (
                    <> · trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}</>
                  )}
                  {shop?.subscription_status === "active" && shop?.current_period_end && (
                    <> · paid through {new Date(shop.current_period_end).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <ManualPaymentPanel
                shopId={s.shopId}
                amount={amount}
                hasPending={pendingShopIds.has(s.shopId)}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}
