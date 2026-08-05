import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import {
  computeLowStock,
  computeDailySeries,
  computePaymentBreakdown,
  type VariantRow,
} from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { hasBillingAccess, statusLabel } from "@/lib/billing-status";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { SalesChart } from "@/components/sales-chart";
import { DashboardRecentSales } from "./recent-sales";
import { AdminDashboardGrid } from "./admin-dashboard-grid";
import { DashboardRealtimeRefresh } from "./realtime-refresh";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  if (profile.inAdminOverview) {
    const activeOwnedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    return <AdminDashboardGrid ownedShops={activeOwnedShops} />;
  }
  if (profile.role !== "owner") redirect("/sell");

  const params = await searchParams;
  const chartDays = params.chart === "30d" ? 30 : 7;

  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 30 * 86400000).toISOString();

  const [{ data: variants }, { data: recentSales }, { data: chartSales }, { data: lastAudit }, { data: staff }] =
    await Promise.all([
      supabase
        .from("variants")
        .select(
          "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
        )
        .eq("shop_id", profile.shopId),
      supabase
        .from("sales")
        .select("id, total, created_at, voided_at, voided_reason")
        .eq("shop_id", profile.shopId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("sales")
        .select("total, payment_method, created_at")
        .eq("shop_id", profile.shopId)
        .gte("created_at", chartWindowStart)
        .is("voided_at", null),
      supabase
        .from("stock_audits")
        .select("id, completed_at")
        .eq("shop_id", profile.shopId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("user_id, display_name").eq("shop_id", profile.shopId),
    ]);

  const admin = createAdminClient();
  const allUsers = await listAllUsers(admin);
  const emailByUserId = new Map(allUsers.map((u) => [u.id, u.email ?? ""]));
  const staffNames = (staff ?? []).map(
    (m) => m.display_name || emailByUserId.get(m.user_id) || "Unnamed",
  );

  let auditDiscrepancyCount = 0;
  let auditValueImpact = 0;
  if (lastAudit) {
    const { data: auditLines } = await supabase
      .from("stock_audit_lines")
      .select("system_qty, counted_qty, variants(cost)")
      .eq("audit_id", lastAudit.id);
    for (const l of auditLines ?? []) {
      if (l.system_qty !== l.counted_qty) {
        auditDiscrepancyCount++;
        const variant = Array.isArray(l.variants) ? l.variants[0] : l.variants;
        auditValueImpact += (l.counted_qty - l.system_qty) * Number(variant?.cost ?? 0);
      }
    }
  }

  const lowStock = computeLowStock(
    (variants ?? []).map((v) => ({
      ...v,
      products: Array.isArray(v.products) ? v.products[0] ?? null : v.products,
    })) as VariantRow[],
  );

  const series = computeDailySeries(chartSales ?? [], chartDays);
  const todayRevenue = series[series.length - 1]?.revenue ?? 0;
  const rangeRevenue = series.reduce((sum, d) => sum + d.revenue, 0);
  const todaySales = (chartSales ?? []).filter(
    (s) => s.created_at.slice(0, 10) === series[series.length - 1]?.date,
  );
  const todayCount = todaySales.length;
  const todayBreakdown = computePaymentBreakdown(todaySales);

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <DashboardRealtimeRefresh shopId={profile.shopId} />
      <h1 className="heading text-2xl">
        {profile.shop.name} — Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">
        Subscription: {statusLabel(profile.shop)}
      </p>

      <Card padding="sm" className="mt-6">
        <h2 className="text-sm font-medium text-muted">Today</h2>
        <div className="mt-2 flex flex-wrap gap-4">
          <Stat label="Sales" value={todayCount.toString()} />
          <Stat label="Cash" value={formatCurrency(todayBreakdown.cash)} />
          <Stat label="GCash" value={formatCurrency(todayBreakdown.gcash)} />
          <Stat label="Total" value={formatCurrency(todayRevenue)} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Last {chartDays} days</h2>
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
        <div className="mt-2 flex flex-wrap gap-4">
          <Stat label="Total" value={formatCurrency(rangeRevenue)} />
        </div>

        <div className="mt-6">
          <SalesChart data={series} />
        </div>
      </Card>

      <div className="mt-4 flex gap-3">
        <Link href="/sell" className={buttonClasses("primary", "sm")}>
          New sale
        </Link>
        <Link href="/inventory" className={buttonClasses("secondary", "sm")}>
          Manage inventory
        </Link>
      </div>

      {profile.ownedShopCount === 1 &&
        profile.shop.subscriptionStatus === "trialing" &&
        hasBillingAccess(profile.shop) && (
          <Card padding="sm" className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-ink">
                Running more than one location? Add your other shops now to see VapeStock
                across your whole business before your trial ends.
              </p>
              <Link
                href="/branches"
                className="shrink-0 text-xs text-primary underline underline-offset-2"
              >
                Add a shop
              </Link>
            </div>
          </Card>
        )}

      <Card padding="sm" className="mt-6">
        <p className="text-xs font-medium uppercase text-muted">Staff assigned</p>
        {staffNames.length === 0 ? (
          <p className="mt-1 text-sm text-ink">No staff yet.</p>
        ) : (
          <p className="mt-1 text-sm text-ink">
            {staffNames.map((name, i) => (
              <span key={`${name}-${i}`}>
                <Link href="/settings/staff" className="hover:text-primary hover:underline">
                  {name}
                </Link>
                {i < staffNames.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}
      </Card>

      <Card padding="sm" className="mt-6">
        <p className="text-xs font-medium uppercase text-muted">Needs attention</p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={`text-sm ${lowStock.length > 0 ? "text-warning" : "text-ink"}`}>
            {lowStock.length === 0
              ? "Nothing low on stock"
              : `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} low on stock`}
          </p>
          {lowStock.length > 0 && (
            <Link
              href="/reports"
              className="shrink-0 text-xs text-warning underline underline-offset-2"
            >
              View details
            </Link>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={`text-sm ${auditDiscrepancyCount > 0 ? "text-warning" : "text-muted"}`}>
            {lastAudit
              ? `Last audit ${new Date(lastAudit.completed_at as string).toLocaleDateString()} — ${
                  auditDiscrepancyCount === 0
                    ? "no discrepancies"
                    : `${auditDiscrepancyCount} discrepanc${auditDiscrepancyCount === 1 ? "y" : "ies"} (${formatCurrency(auditValueImpact)})`
                }`
              : "No audits yet"}
          </p>
          <Link
            href="/audit"
            className={`shrink-0 text-xs underline underline-offset-2 ${auditDiscrepancyCount > 0 ? "text-warning" : "text-primary"}`}
          >
            View recent audit
          </Link>
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
            voidedReason: s.voided_reason,
          }))}
        />
      </Card>
    </main>
  );
}
