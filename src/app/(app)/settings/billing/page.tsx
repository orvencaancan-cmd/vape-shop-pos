import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { openBillingPortalAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
};

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("subscription_status, trial_ends_at, current_period_end, stripe_customer_id")
    .eq("id", profile.shopId)
    .single();

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">Billing</h1>

      <div className="mt-6 rounded-xl border border-hairline bg-canvas-soft p-4">
        <p className="text-sm text-muted">Subscription status</p>
        <p className="text-lg font-semibold text-ink">
          {STATUS_LABEL[shop?.subscription_status ?? ""] ?? shop?.subscription_status}
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

      {shop?.stripe_customer_id ? (
        <form action={openBillingPortalAction} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
          >
            Manage billing
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No billing account on file yet — this shows up once your subscription
          checkout is complete.
        </p>
      )}
    </main>
  );
}
