import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { openBillingPortalAction, startSubscriptionAction } from "./actions";
import { statusLabel } from "@/lib/billing-status";
import { getPriceLabels } from "@/lib/stripe-prices";
import { RatesPopup } from "@/components/rates-popup";
import { AdminBillingList } from "./admin-billing-list";

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  if (profile.inAdminOverview) {
    const activeOwnedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    return <AdminBillingList ownedShops={activeOwnedShops} />;
  }
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("subscription_status, trial_ends_at, current_period_end, stripe_customer_id")
    .eq("id", profile.shopId)
    .single();

  const boundOpenPortal = openBillingPortalAction.bind(null, profile.shopId);
  const boundStartSubscription = startSubscriptionAction.bind(null, profile.shopId);
  // A shop that subscribed once and later canceled keeps its
  // stripe_customer_id forever, so gating the button on that alone would
  // route a resubscribing owner into the billing portal, which can't
  // restart a fully-canceled subscription — decide by state instead.
  const needsSubscribe =
    shop?.subscription_status === "trialing" || shop?.subscription_status === "canceled";
  const prices = await getPriceLabels();

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading text-2xl">Billing</h1>
        <RatesPopup
          prices={prices}
          subscribeAction={needsSubscribe ? boundStartSubscription : undefined}
        />
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-canvas-soft p-4">
        <p className="text-sm text-muted">Subscription status</p>
        <p className="text-lg font-semibold text-ink">
          {shop
            ? statusLabel({
                subscriptionStatus: shop.subscription_status,
                trialEndsAt: shop.trial_ends_at,
              })
            : "—"}
        </p>
        {shop?.subscription_status === "trialing" && shop.trial_ends_at && (
          <p className="mt-1 text-xs text-muted">
            Free trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}
          </p>
        )}
        {(shop?.subscription_status === "active" || shop?.subscription_status === "past_due") &&
          shop.current_period_end && (
            <p className="mt-1 text-xs text-muted">
              Renews {new Date(shop.current_period_end).toLocaleDateString()}
            </p>
          )}
      </div>

      {needsSubscribe ? (
        <form action={boundStartSubscription} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
          >
            Subscribe
          </button>
        </form>
      ) : (
        <form action={boundOpenPortal} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
          >
            Manage billing
          </button>
        </form>
      )}
    </main>
  );
}
