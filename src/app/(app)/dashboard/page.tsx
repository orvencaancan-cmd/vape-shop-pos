import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { computeLowStock, computeDailySeries, type VariantRow } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { DashboardRecentSales } from "./recent-sales";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/sell");

  const params = await searchParams;
  const chartDays = params.chart === "30d" ? 30 : 7;

  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 30 * 86400000).toISOString();

  const [{ data: variants }, { data: recentSales }, { data: chartSales }] = await Promise.all([
    supabase
      .from("variants")
      .select(
        "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
      ),
    supabase
      .from("sales")
      .select("id, total, created_at, voided_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("sales")
      .select("total, created_at")
      .gte("created_at", chartWindowStart)
      .is("voided_at", null),
  ]);

  const lowStock = computeLowStock(
    (variants ?? []).map((v) => ({
      ...v,
      products: Array.isArray(v.products) ? v.products[0] ?? null : v.products,
    })) as VariantRow[],
  );

  const series = computeDailySeries(chartSales ?? [], chartDays);
  const todayRevenue = series[series.length - 1]?.revenue ?? 0;
  const weekRevenue = computeDailySeries(chartSales ?? [], 7).reduce(
    (sum, d) => sum + d.revenue,
    0,
  );
  const todayCount = (chartSales ?? []).filter(
    (s) => s.created_at.slice(0, 10) === series[series.length - 1]?.date,
  ).length;

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">
        {profile.shop.name} — Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">
        Subscription: {profile.shop.subscriptionStatus}
      </p>

      {lowStock.length > 0 && (
        <Card
          padding="sm"
          className="mt-6 border-warning/40 bg-warning/10"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-warning">⚠</span>
              <h2 className="text-sm font-medium text-warning">
                {lowStock.length} item{lowStock.length === 1 ? "" : "s"} low on stock
              </h2>
            </div>
            <Link href="/reports" className="text-xs text-warning underline underline-offset-2">
              Full reports
            </Link>
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {lowStock.slice(0, 8).map((v) => (
              <li key={v.id} className="flex justify-between">
                <span className="text-ink">
                  {v.productName} — {v.label}
                </span>
                <Badge variant="warning">{v.stockQty} left</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs text-muted">Today</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(todayRevenue)}</p>
          <p className="text-xs text-muted">{todayCount} sale{todayCount === 1 ? "" : "s"}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-muted">Last 7 days</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(weekRevenue)}</p>
        </Card>
        <Card padding="sm" className="col-span-2 flex flex-col justify-center gap-2 sm:col-span-1">
          <Link href="/sell" className={buttonClasses("primary", "sm")}>
            New sale
          </Link>
          <Link href="/inventory" className={buttonClasses("secondary", "sm")}>
            Manage inventory
          </Link>
        </Card>
      </div>

      <Card padding="sm" className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Sales</h2>
          <div className="flex gap-2 text-xs">
            <Link
              href="/dashboard?chart=7d"
              className={chartDays === 7 ? "text-primary underline underline-offset-2" : "text-muted hover:text-ink"}
            >
              7 days
            </Link>
            <Link
              href="/dashboard?chart=30d"
              className={chartDays === 30 ? "text-primary underline underline-offset-2" : "text-muted hover:text-ink"}
            >
              30 days
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <SalesChart data={series} />
        </div>
      </Card>

      <Card padding="sm" className="mt-6">
        <h2 className="text-sm font-medium text-muted">Recent sales</h2>
        <DashboardRecentSales
          sales={(recentSales ?? []).map((s) => ({
            id: s.id,
            total: Number(s.total),
            createdAt: s.created_at,
            voidedAt: s.voided_at,
          }))}
        />
      </Card>
    </main>
  );
}

function SalesChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const step = data.length > 10 ? Math.ceil(data.length / 6) : 1;

  return (
    <div className="flex items-end gap-1">
      {data.map((d, i) => {
        const showLabel = i % step === 0 || i === data.length - 1;
        const label =
          data.length > 10
            ? new Date(`${d.date}T00:00:00Z`).getUTCDate().toString()
            : new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t-sm bg-primary/80 transition-all"
                style={{ height: `${Math.max((d.revenue / max) * 100, d.revenue > 0 ? 4 : 1)}%` }}
                title={`${d.date}: ${formatCurrency(d.revenue)}`}
              />
            </div>
            <span className="text-[10px] text-muted">{showLabel ? label : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
