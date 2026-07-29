import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeLowStock,
  computeDailySeries,
  computePaymentBreakdown,
  type VariantRow,
} from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { SalesChart } from "@/components/sales-chart";
import { switchShopAction } from "@/lib/auth/actions";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminDashboardGrid({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 7 * 86400000).toISOString();

  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailByUserId = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  const cards = await Promise.all(
    ownedShops.map(async (s) => {
      const [{ data: variants }, { data: weekSales }, { data: staff }, { data: lastAudit }] =
        await Promise.all([
          supabase
            .from("variants")
            .select(
              "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
            )
            .eq("shop_id", s.shopId),
          supabase
            .from("sales")
            .select("total, payment_method, created_at")
            .eq("shop_id", s.shopId)
            .gte("created_at", chartWindowStart)
            .is("voided_at", null),
          supabase.from("profiles").select("user_id, display_name").eq("shop_id", s.shopId),
          supabase
            .from("stock_audits")
            .select("id, completed_at")
            .eq("shop_id", s.shopId)
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      const lowStock = computeLowStock(
        (variants ?? []).map((v) => ({
          ...v,
          products: Array.isArray(v.products) ? (v.products[0] ?? null) : v.products,
        })) as VariantRow[],
      );
      const series = computeDailySeries(weekSales ?? [], 7);
      const todayRevenue = series[series.length - 1]?.revenue ?? 0;
      const todaySales = (weekSales ?? []).filter(
        (sale) => sale.created_at.slice(0, 10) === series[series.length - 1]?.date,
      );
      const todayCount = todaySales.length;
      const todayBreakdown = computePaymentBreakdown(todaySales);

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

      return {
        shopId: s.shopId,
        shopName: s.shopName,
        todayRevenue,
        todayCount,
        series,
        todayBreakdown,
        lowStock,
        staffNames,
        lastAuditCompletedAt: (lastAudit?.completed_at as string | undefined) ?? null,
        auditDiscrepancyCount,
        auditValueImpact,
      };
    }),
  );

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Dashboard</h1>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.shopId} padding="md">
            <form action={switchShopAction.bind(null, c.shopId, "owner", "/dashboard")}>
              <button type="submit" className="block w-full text-left">
                <h2 className="text-sm font-semibold text-ink">{c.shopName}</h2>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase text-muted">Today</p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {formatCurrency(c.todayRevenue)}
                  </p>
                  <p className="text-xs text-muted">
                    {c.todayCount} sale{c.todayCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted">
                    Cash {formatCurrency(c.todayBreakdown.cash)} · GCash{" "}
                    {formatCurrency(c.todayBreakdown.gcash)}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase text-muted">Last 7 days</p>
                  <div className="mt-2">
                    <SalesChart data={c.series} barHeight="h-16" />
                  </div>
                </div>
              </button>
            </form>

            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-xs font-medium uppercase text-muted">Staff assigned</p>
              {c.staffNames.length === 0 ? (
                <p className="mt-1 text-sm text-ink">No staff yet.</p>
              ) : (
                <p className="mt-1 text-sm text-ink">
                  {c.staffNames.map((name, i) => (
                    <span key={`${name}-${i}`}>
                      <Link
                        href="/settings/staff"
                        className="hover:text-primary hover:underline"
                      >
                        {name}
                      </Link>
                      {i < c.staffNames.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-xs font-medium uppercase text-muted">Needs attention</p>

              <div className="mt-1 flex items-center justify-between gap-2">
                <p className={`text-sm ${c.lowStock.length > 0 ? "text-warning" : "text-ink"}`}>
                  {c.lowStock.length === 0
                    ? "Nothing low on stock"
                    : `${c.lowStock.length} item${c.lowStock.length === 1 ? "" : "s"} low on stock`}
                </p>
                {c.lowStock.length > 0 && (
                  <form action={switchShopAction.bind(null, c.shopId, "owner", "/reports")}>
                    <button
                      type="submit"
                      className="shrink-0 text-xs text-warning underline underline-offset-2"
                    >
                      View details
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p
                  className={`text-sm ${c.auditDiscrepancyCount > 0 ? "text-warning" : "text-muted"}`}
                >
                  {c.lastAuditCompletedAt
                    ? `Last audit ${new Date(c.lastAuditCompletedAt).toLocaleDateString()} — ${
                        c.auditDiscrepancyCount === 0
                          ? "no discrepancies"
                          : `${c.auditDiscrepancyCount} discrepanc${c.auditDiscrepancyCount === 1 ? "y" : "ies"} (${formatCurrency(c.auditValueImpact)})`
                      }`
                    : "No audits yet"}
                </p>
                <form action={switchShopAction.bind(null, c.shopId, "owner", "/audit")}>
                  <button
                    type="submit"
                    className={`shrink-0 text-xs underline underline-offset-2 ${c.auditDiscrepancyCount > 0 ? "text-warning" : "text-primary"}`}
                  >
                    View recent audit
                  </button>
                </form>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
