import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, subscription_status, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  const counts = { trialing: 0, active: 0, past_due: 0, canceled: 0 };
  for (const s of shops ?? []) {
    counts[s.subscription_status as keyof typeof counts] =
      (counts[s.subscription_status as keyof typeof counts] ?? 0) + 1;
  }

  let mrrLabel = "—";
  if (process.env.STRIPE_PRICE_ID && counts.active > 0) {
    try {
      const stripe = getStripe();
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
      const amount = ((price.unit_amount ?? 0) / 100) * counts.active;
      mrrLabel = `${amount.toFixed(2)} ${price.currency.toUpperCase()}`;
    } catch {
      mrrLabel = "—";
    }
  } else if (counts.active === 0) {
    mrrLabel = "0.00";
  }

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">Platform admin</h1>

      <div className="stagger mt-6 flex flex-wrap gap-4">
        <Stat label="Total shops" value={String(shops?.length ?? 0)} />
        <Stat label="Trialing" value={String(counts.trialing)} />
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
                <td className="py-1.5 pr-3 text-ink">{s.name}</td>
                <td className="py-1.5 pr-3 text-body">
                  {STATUS_LABEL[s.subscription_status] ?? s.subscription_status}
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
    <div className="rounded-lg border border-hairline bg-canvas-soft px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
