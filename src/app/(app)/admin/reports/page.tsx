// Account-level only: never query products/variants/sales/sale_items/stock_receipts/suppliers here.
// "Revenue" on this page is VapeStock's own subscription revenue (from Stripe),
// never a subscriber shop's retail sales.
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import type Stripe from "stripe";

async function fetchAllPaidInvoices(stripe: Stripe): Promise<Stripe.Invoice[]> {
  const results: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.invoices.list({
      status: "paid",
      limit: 100,
      starting_after: startingAfter,
    });
    results.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return results;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export default async function AdminReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shops")
    .select("id, subscription_status, created_at, suspended_at")
    .eq("is_platform_shop", false)
    .order("created_at");

  const months = lastNMonthKeys(6);

  const signupsByMonth = new Map(months.map((m) => [m, 0]));
  for (const s of shops ?? []) {
    const key = monthKey(new Date(s.created_at));
    if (signupsByMonth.has(key)) signupsByMonth.set(key, (signupsByMonth.get(key) ?? 0) + 1);
  }

  const statusCounts = { trialing: 0, active: 0, past_due: 0, canceled: 0 };
  let suspendedCount = 0;
  for (const s of shops ?? []) {
    statusCounts[s.subscription_status as keyof typeof statusCounts] =
      (statusCounts[s.subscription_status as keyof typeof statusCounts] ?? 0) + 1;
    if (s.suspended_at) suspendedCount += 1;
  }

  const totalShops = shops?.length ?? 0;
  const everLeftTrial = statusCounts.active + statusCounts.past_due + statusCounts.canceled;
  const conversionRate = totalShops > 0 ? (everLeftTrial / totalShops) * 100 : 0;

  let revenueByMonth = new Map(months.map((m) => [m, 0]));
  let totalRevenueCents = 0;
  let currency = "php";
  let revenueError: string | null = null;
  try {
    const stripe = getStripe();
    const invoices = await fetchAllPaidInvoices(stripe);
    for (const inv of invoices) {
      totalRevenueCents += inv.amount_paid;
      currency = inv.currency;
      const key = monthKey(new Date(inv.created * 1000));
      if (revenueByMonth.has(key)) {
        revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + inv.amount_paid);
      }
    }
  } catch {
    revenueError = "Couldn't load Stripe revenue data.";
    revenueByMonth = new Map(months.map((m) => [m, 0]));
  }

  const revenueSeries = months.map((m) => ({
    month: m,
    amount: (revenueByMonth.get(m) ?? 0) / 100,
  }));
  const signupSeries = months.map((m) => ({ month: m, count: signupsByMonth.get(m) ?? 0 }));

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-normal text-ink">Platform reports</h1>
      <p className="mt-1 text-xs text-muted">
        VapeStock&apos;s own subscription revenue and growth — not subscriber sales data.
      </p>

      <div className="stagger mt-6 flex flex-wrap gap-4">
        <Stat
          label="Total revenue collected"
          value={revenueError ? "—" : `${formatCurrency(totalRevenueCents / 100)} ${currency.toUpperCase()}`}
        />
        <Stat label="Total shops" value={String(totalShops)} />
        <Stat
          label="Trial → paid conversion"
          value={totalShops > 0 ? `${conversionRate.toFixed(0)}%` : "—"}
        />
        <Stat label="Suspended" value={String(suspendedCount)} />
      </div>
      {revenueError && <p className="mt-2 text-xs text-error">{revenueError}</p>}
      <p className="mt-2 text-xs text-muted">
        Conversion rate is approximate: the share of shops that have ever left trial status
        (active, past due, or canceled), based on current status only.
      </p>

      <Card padding="sm" className="mt-6">
        <h2 className="text-sm font-medium text-muted">Revenue by month</h2>
        <div className="mt-4">
          <MonthlyBarChart
            data={revenueSeries.map((d) => ({ key: d.month, value: d.amount }))}
            formatValue={(v) => formatCurrency(v)}
          />
        </div>
      </Card>

      <Card padding="sm" className="mt-6">
        <h2 className="text-sm font-medium text-muted">Signups by month</h2>
        <div className="mt-4">
          <MonthlyBarChart
            data={signupSeries.map((d) => ({ key: d.month, value: d.count }))}
            formatValue={(v) => String(v)}
          />
        </div>
      </Card>

      <Card padding="sm" className="mt-6">
        <h2 className="text-sm font-medium text-muted">Current status breakdown</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {Object.entries(statusCounts).map(([status, count]) => (
            <li key={status} className="flex justify-between">
              <span className="text-ink">{STATUS_LABEL[status] ?? status}</span>
              <span className="text-muted">{count}</span>
            </li>
          ))}
        </ul>
      </Card>
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

function MonthlyBarChart({
  data,
  formatValue,
}: {
  data: { key: string; value: number }[];
  formatValue: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2">
      {data.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-24 w-full items-end">
            <div
              className="w-full rounded-t-sm bg-primary/80 transition-all"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 1)}%` }}
              title={`${monthLabel(d.key)}: ${formatValue(d.value)}`}
            />
          </div>
          <span className="text-[10px] text-muted">{monthLabel(d.key)}</span>
        </div>
      ))}
    </div>
  );
}
