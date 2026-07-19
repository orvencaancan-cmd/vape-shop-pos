import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { computeLowStock, type VariantRow } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/sell");

  const supabase = await createClient();

  const [{ data: variants }, { data: recentSales }] = await Promise.all([
    supabase
      .from("variants")
      .select(
        "id, flavor, nicotine_mg, size, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
      ),
    supabase
      .from("sales")
      .select("id, total, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const lowStock = computeLowStock(
    (variants ?? []).map((v) => ({
      ...v,
      products: Array.isArray(v.products) ? v.products[0] ?? null : v.products,
    })) as VariantRow[],
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{profile.shop.name} — Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Subscription: {profile.shop.subscriptionStatus}
      </p>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-500">Low stock</h2>
          <Link href="/reports" className="text-xs text-slate-400 underline">
            Full reports
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nothing is low on stock.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {lowStock.slice(0, 8).map((v) => (
              <li key={v.id} className="flex justify-between">
                <span className="text-slate-800">
                  {v.productName} — {v.label}
                </span>
                <span className="text-red-600">{v.stockQty} left</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-500">Recent sales</h2>
        {(recentSales?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No sales yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {recentSales!.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span className="text-slate-500">
                  {new Date(s.created_at).toLocaleString()}
                </span>
                <span className="text-slate-800">{formatCurrency(Number(s.total))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
