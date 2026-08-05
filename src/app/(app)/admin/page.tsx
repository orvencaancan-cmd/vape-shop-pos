import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { statusLabel, isTrialExpired, isPeriodExpired } from "@/lib/billing-status";
import { TIER_AMOUNTS } from "@/lib/manual-payment";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: shops }, { count: pendingPaymentCount }, { data: lastSales }, { data: featureAdoption }] =
    await Promise.all([
      supabase
        .from("shops")
        .select(
          "id, name, subscription_status, trial_ends_at, current_period_end, suspended_at, created_at, billing_tier",
        )
        .eq("is_platform_shop", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("manual_payment_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.rpc("get_last_sale_dates"),
      supabase.rpc("get_feature_adoption"),
    ]);
  const lastSaleByShopId = new Map(
    ((lastSales ?? []) as { shop_id: string; last_sale_at: string }[]).map((r) => [
      r.shop_id,
      r.last_sale_at,
    ]),
  );
  const featureRows = ((featureAdoption ?? []) as { feature: string; shop_count: number }[]).sort(
    (a, b) => b.shop_count - a.shop_count,
  );

  const counts = { trialing: 0, trialExpired: 0, active: 0, paymentDue: 0, past_due: 0, canceled: 0 };
  const activeByTier = { primary: 0, additional: 0 };
  for (const s of shops ?? []) {
    const shopFields = {
      subscriptionStatus: s.subscription_status,
      trialEndsAt: s.trial_ends_at,
      currentPeriodEnd: s.current_period_end,
    };
    if (s.subscription_status === "trialing" && isTrialExpired(shopFields)) {
      counts.trialExpired++;
    } else if (s.subscription_status === "active" && isPeriodExpired(shopFields)) {
      counts.paymentDue++;
    } else {
      counts[s.subscription_status as keyof typeof counts] =
        (counts[s.subscription_status as keyof typeof counts] ?? 0) + 1;
    }
    if (s.subscription_status === "active" && !isPeriodExpired(shopFields)) {
      activeByTier[s.billing_tier as "primary" | "additional"]++;
    }
  }

  const mrr = activeByTier.primary * TIER_AMOUNTS.primary + activeByTier.additional * TIER_AMOUNTS.additional;
  const mrrLabel = `${mrr.toFixed(2)} PHP`;

  const neverSoldCount = (shops ?? []).filter((s) => !lastSaleByShopId.has(s.id)).length;
  const totalShops = shops?.length ?? 0;

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading text-2xl">Platform admin</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/activity" className="text-xs text-primary underline underline-offset-2">
            Activity
          </Link>
          <Link
            href="/admin/payments"
            className="text-xs text-primary underline underline-offset-2"
          >
            Pending payments{pendingPaymentCount ? ` (${pendingPaymentCount})` : ""}
          </Link>
          <Link href="/admin/reports" className="text-xs text-primary underline underline-offset-2">
            View reports
          </Link>
        </div>
      </div>

      <div className="stagger mt-6 flex flex-wrap gap-4">
        <Stat label="Total shops" value={String(shops?.length ?? 0)} />
        <Stat label="Trialing" value={String(counts.trialing)} />
        <Stat label="Trial expired" value={String(counts.trialExpired)} />
        <Stat label="Active" value={String(counts.active)} />
        <Stat label="Payment due" value={String(counts.paymentDue)} />
        <Stat label="Past due" value={String(counts.past_due)} />
        <Stat label="Canceled" value={String(counts.canceled)} />
        <Stat label="MRR (from active)" value={mrrLabel} />
        <Stat label="Never sold" value={String(neverSoldCount)} />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">All shops</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="py-1.5 pr-3">Shop</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5 pr-3">Trial ends</th>
              <th className="py-1.5 pr-3">Signed up</th>
              <th className="py-1.5">Last sale</th>
            </tr>
          </thead>
          <tbody>
            {(shops ?? []).map((s) => {
              const signedUpDays = daysSince(s.created_at);
              const lastSaleAt = lastSaleByShopId.get(s.id);
              const stalled = !lastSaleAt && signedUpDays > 7;
              return (
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
                      currentPeriodEnd: s.current_period_end,
                    })}
                    {s.suspended_at && <span className="ml-1 text-xs text-error">(suspended)</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">
                    {s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">
                    {new Date(s.created_at).toLocaleDateString()} ({formatDaysAgo(signedUpDays)})
                  </td>
                  <td className={`py-1.5 ${stalled ? "text-warning" : "text-muted"}`}>
                    {lastSaleAt
                      ? `${new Date(lastSaleAt).toLocaleDateString()} (${formatDaysAgo(daysSince(lastSaleAt))})`
                      : "No sales yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Feature adoption</h2>
      {featureRows.length > 0 && featureRows[0].shop_count > 0 && (
        <p className="mt-1 text-sm text-ink">
          Most used: <span className="font-medium">{featureRows[0].feature}</span> —{" "}
          {featureRows[0].shop_count} of {totalShops} shops
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {featureRows.map((f) => {
          const pct = totalShops > 0 ? Math.round((f.shop_count / totalShops) * 100) : 0;
          return (
            <div key={f.feature} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-body">{f.feature}</span>
              <div className="h-1.5 flex-1 rounded-full bg-canvas-strong">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-muted">
                {f.shop_count}/{totalShops} ({pct}%)
              </span>
            </div>
          );
        })}
        {featureRows.length === 0 && (
          <p className="text-sm text-muted">No feature usage yet.</p>
        )}
      </div>
    </main>
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
