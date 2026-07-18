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
    .select("subscription_status, trial_ends_at, stripe_customer_id")
    .eq("id", profile.shopId)
    .single();

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>

      <div className="mt-6 rounded-md border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Subscription status</p>
        <p className="text-lg font-semibold text-slate-900">
          {STATUS_LABEL[shop?.subscription_status ?? ""] ?? shop?.subscription_status}
        </p>
        {shop?.subscription_status === "trialing" && shop.trial_ends_at && (
          <p className="mt-1 text-xs text-slate-400">
            Trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {shop?.stripe_customer_id ? (
        <form action={openBillingPortalAction} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Manage billing
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          No billing account on file yet — this shows up once your subscription
          checkout is complete.
        </p>
      )}
    </main>
  );
}
