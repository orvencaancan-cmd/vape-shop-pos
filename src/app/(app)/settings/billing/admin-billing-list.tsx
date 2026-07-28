import { createClient } from "@/lib/supabase/server";
import { openBillingPortalAction, startSubscriptionAction } from "./actions";
import { statusLabel } from "@/lib/billing-status";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminBillingList({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const shopIds = ownedShops.map((s) => s.shopId);
  const { data: shops } = await supabase
    .from("shops")
    .select("id, subscription_status, trial_ends_at, current_period_end, stripe_customer_id")
    .in("id", shopIds);

  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Billing</h1>
      <p className="mt-1 text-sm text-muted">
        Each branch keeps its own subscription. Bundled multi-branch pricing is coming soon.
      </p>

      <div className="stagger mt-6 flex flex-col gap-3">
        {ownedShops.map((s) => {
          const shop = shopById.get(s.shopId);
          const boundOpenPortal = openBillingPortalAction.bind(null, s.shopId);
          const boundStartSubscription = startSubscriptionAction.bind(null, s.shopId);
          const needsSubscribe =
            shop?.subscription_status === "trialing" || shop?.subscription_status === "canceled";
          return (
            <div
              key={s.shopId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-canvas-soft p-4"
            >
              <div>
                <p className="text-sm font-medium text-ink">{s.shopName}</p>
                <p className="text-xs text-muted">
                  {shop
                    ? statusLabel({
                        subscriptionStatus: shop.subscription_status,
                        trialEndsAt: shop.trial_ends_at,
                      })
                    : "—"}
                  {shop?.subscription_status === "trialing" && shop.trial_ends_at && (
                    <> · trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}</>
                  )}
                  {(shop?.subscription_status === "active" || shop?.subscription_status === "past_due") &&
                    shop?.current_period_end && (
                      <> · renews {new Date(shop.current_period_end).toLocaleDateString()}</>
                    )}
                </p>
              </div>
              <form action={needsSubscribe ? boundStartSubscription : boundOpenPortal}>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  {needsSubscribe ? "Subscribe" : "Manage billing"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </main>
  );
}
