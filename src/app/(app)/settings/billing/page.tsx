import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/billing-status";
import { TIER_AMOUNTS } from "@/lib/manual-payment";
import { RatesPopup } from "@/components/rates-popup";
import { AdminBillingList } from "./admin-billing-list";
import { ManualPaymentPanel } from "./manual-payment-panel";

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
  const [{ data: shop }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("shops")
      .select("subscription_status, trial_ends_at, current_period_end, billing_tier")
      .eq("id", profile.shopId)
      .single(),
    supabase
      .from("manual_payment_requests")
      .select("id")
      .eq("shop_id", profile.shopId)
      .eq("status", "pending")
      .limit(1),
  ]);

  const amount = TIER_AMOUNTS[(shop?.billing_tier as "primary" | "additional") ?? "primary"];

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading text-2xl">Billing</h1>
        <RatesPopup amounts={TIER_AMOUNTS} />
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-canvas-soft p-4">
        <p className="text-sm text-muted">Subscription status</p>
        <p className="text-lg font-semibold text-ink">
          {shop
            ? statusLabel({
                subscriptionStatus: shop.subscription_status,
                trialEndsAt: shop.trial_ends_at,
                currentPeriodEnd: shop.current_period_end,
              })
            : "—"}
        </p>
        {shop?.subscription_status === "trialing" && shop.trial_ends_at && (
          <p className="mt-1 text-xs text-muted">
            Free trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}
          </p>
        )}
        {shop?.subscription_status === "active" && shop.current_period_end && (
          <p className="mt-1 text-xs text-muted">
            Paid through {new Date(shop.current_period_end).toLocaleDateString()}
          </p>
        )}
      </div>

      <ManualPaymentPanel
        shopId={profile.shopId}
        amount={amount}
        hasPending={(pendingRequests?.length ?? 0) > 0}
      />
    </main>
  );
}
