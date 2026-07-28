import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { statusLabel, isTrialExpired } from "@/lib/billing-status";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shops")
    .select(
      "id, name, subscription_status, trial_ends_at, suspended_at, created_at, billing_tier",
    )
    .eq("is_platform_shop", false)
    .order("created_at", { ascending: false });

  const counts = { trialing: 0, trialExpired: 0, active: 0, past_due: 0, canceled: 0 };
  const activeByTier = { primary: 0, additional: 0 };
  for (const s of shops ?? []) {
    const shopFields = { subscriptionStatus: s.subscription_status, trialEndsAt: s.trial_ends_at };
    if (s.subscription_status === "trialing" && isTrialExpired(shopFields)) {
      counts.trialExpired++;
    } else {
      counts[s.subscription_status as keyof typeof counts] =
        (counts[s.subscription_status as keyof typeof counts] ?? 0) + 1;
    }
    if (s.subscription_status === "active") {
      activeByTier[s.billing_tier as "primary" | "additional"]++;
    }
  }

  let mrrLabel = "—";
  const totalActive = activeByTier.primary + activeByTier.additional;
  if (process.env.STRIPE_PRICE_ID && process.env.STRIPE_PRICE_ID_ADDITIONAL && totalActive > 0) {
    try {
      const stripe = getStripe();
      const [primaryPrice, additionalPrice] = await Promise.all([
        stripe.prices.retrieve(process.env.STRIPE_PRICE_ID),
        stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_ADDITIONAL),
      ]);
      const amount =
        ((primaryPrice.unit_amount ?? 0) / 100) * activeByTier.primary +
        ((additionalPrice.unit_amount ?? 0) / 100) * activeByTier.additional;
      mrrLabel = `${amount.toFixed(2)} ${primaryPrice.currency.toUpperCase()}`;
    } catch {
      mrrLabel = "—";
    }
  } else if (totalActive === 0) {
    mrrLabel = "0.00";
  }

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl">Platform admin</h1>
        <Link href="/admin/reports" className="text-xs text-primary underline underline-offset-2">
          View reports
        </Link>
      </div>

      <div className="stagger mt-6 flex flex-wrap gap-4">
        <Stat label="Total shops" value={String(shops?.length ?? 0)} />
        <Stat label="Trialing" value={String(counts.trialing)} />
        <Stat label="Trial expired" value={String(counts.trialExpired)} />
        <Stat label="Active" value={String(counts.active)} />
        <Stat label="Past due" value={String(counts.past_due)} />
        <Stat label="Canceled" value={String(counts.canceled)} />
        <Stat label="MRR (from active)" value={mrrLabel} />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">All shops</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="py-1.5 pr-3">Shop</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5 pr-3">Trial ends</th>
              <th className="py-1.5">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {(shops ?? []).map((s) => (
              <tr key={s.id} className="border-b border-hairline">
                <td className="py-1.5 pr-3">
                  <Link
                    href={`/admin/${s.id}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-body">
                  {statusLabel({
                    subscriptionStatus: s.subscription_status,
                    trialEndsAt: s.trial_ends_at,
                  })}
                  {s.suspended_at && <span className="ml-1 text-xs text-error">(suspended)</span>}
                </td>
                <td className="py-1.5 pr-3 text-muted">
                  {s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : "—"}
                </td>
                <td className="py-1.5 text-muted">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
