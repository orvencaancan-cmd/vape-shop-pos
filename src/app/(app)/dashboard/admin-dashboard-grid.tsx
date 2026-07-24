import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLowStock, computeDailySeries, type VariantRow } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminDashboardGrid({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 7 * 86400000).toISOString();

  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailByUserId = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  const cards = await Promise.all(
    ownedShops.map(async (s) => {
      const [{ data: variants }, { data: weekSales }, { data: staff }] = await Promise.all([
        supabase
          .from("variants")
          .select(
            "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
          )
          .eq("shop_id", s.shopId),
        supabase
          .from("sales")
          .select("total, created_at")
          .eq("shop_id", s.shopId)
          .gte("created_at", chartWindowStart)
          .is("voided_at", null),
        supabase.from("profiles").select("user_id, display_name").eq("shop_id", s.shopId),
      ]);

      const lowStock = computeLowStock(
        (variants ?? []).map((v) => ({
          ...v,
          products: Array.isArray(v.products) ? (v.products[0] ?? null) : v.products,
        })) as VariantRow[],
      );
      const series = computeDailySeries(weekSales ?? [], 7);
      const todayRevenue = series[series.length - 1]?.revenue ?? 0;

      const staffNames = (staff ?? []).map(
        (m) => m.display_name || emailByUserId.get(m.user_id) || "Unnamed",
      );

      return {
        shopId: s.shopId,
        shopName: s.shopName,
        todayRevenue,
        lowStock,
        staffNames,
      };
    }),
  );

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Dashboard</h1>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.shopId} padding="md">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{c.shopName}</h2>
              <span className="text-sm text-ink">{formatCurrency(c.todayRevenue)} today</span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-muted">Low on stock</p>
              {c.lowStock.length === 0 ? (
                <p className="mt-1 text-sm text-ink">Nothing low.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {c.lowStock.slice(0, 5).map((v) => (
                    <li key={v.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">
                        {v.productName} — {v.label}
                      </span>
                      <Badge variant="warning">{v.stockQty} left</Badge>
                    </li>
                  ))}
                  {c.lowStock.length > 5 && (
                    <li className="text-xs text-muted">
                      +{c.lowStock.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-muted">Staff assigned</p>
              {c.staffNames.length === 0 ? (
                <p className="mt-1 text-sm text-ink">No staff yet.</p>
              ) : (
                <p className="mt-1 text-sm text-ink">{c.staffNames.join(", ")}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
