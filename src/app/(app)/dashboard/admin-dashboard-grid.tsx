import { createClient } from "@/lib/supabase/server";
import { computeLowStock, computeDailySeries, type VariantRow } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminDashboardGrid({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 7 * 86400000).toISOString();

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
        supabase.from("profiles").select("id").eq("shop_id", s.shopId),
      ]);

      const lowStock = computeLowStock(
        (variants ?? []).map((v) => ({
          ...v,
          products: Array.isArray(v.products) ? (v.products[0] ?? null) : v.products,
        })) as VariantRow[],
      );
      const series = computeDailySeries(weekSales ?? [], 7);
      const todayRevenue = series[series.length - 1]?.revenue ?? 0;

      return {
        shopId: s.shopId,
        shopName: s.shopName,
        todayRevenue,
        lowStockCount: lowStock.length,
        staffCount: (staff ?? []).length,
      };
    }),
  );

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Dashboard</h1>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.shopId} padding="md">
            <h2 className="text-sm font-semibold text-ink">{c.shopName}</h2>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Today&apos;s sales</dt>
                <dd className="text-ink">{formatCurrency(c.todayRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Low on stock</dt>
                <dd>
                  {c.lowStockCount > 0 ? (
                    <Badge variant="warning">{c.lowStockCount}</Badge>
                  ) : (
                    <span className="text-ink">0</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Staff assigned</dt>
                <dd className="text-ink">{c.staffCount}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </main>
  );
}
