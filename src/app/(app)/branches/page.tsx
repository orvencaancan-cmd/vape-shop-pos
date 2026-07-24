import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { switchShopAction } from "@/lib/auth/actions";
import { computeLowStock, computeDailySeries, type VariantRow } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";
import { StaffRow } from "./staff-row";

export default async function BranchesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  const ownedShops = profile.shops.filter((s) => s.role === "owner");
  if (ownedShops.length < 2) redirect(profile.role === "owner" ? "/dashboard" : "/sell");

  const supabase = await createClient();
  const chartWindowStart = new Date(new Date().getTime() - 7 * 86400000).toISOString();

  const branchData = await Promise.all(
    ownedShops.map(async (s) => {
      const [{ data: variants }, { data: weekSales }] = await Promise.all([
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
      ]);

      const lowStock = computeLowStock(
        (variants ?? []).map((v) => ({
          ...v,
          products: Array.isArray(v.products) ? (v.products[0] ?? null) : v.products,
        })) as VariantRow[],
      );

      const series = computeDailySeries(weekSales ?? [], 7);
      const todayRevenue = series[series.length - 1]?.revenue ?? 0;
      const weekRevenue = series.reduce((sum, d) => sum + d.revenue, 0);

      return { shopId: s.shopId, shopName: s.shopName, lowStock, todayRevenue, weekRevenue };
    }),
  );

  const combined = branchData.reduce(
    (acc, b) => ({
      todayRevenue: acc.todayRevenue + b.todayRevenue,
      weekRevenue: acc.weekRevenue + b.weekRevenue,
      lowStockCount: acc.lowStockCount + b.lowStock.length,
    }),
    { todayRevenue: 0, weekRevenue: 0, lowStockCount: 0 },
  );

  const shopIds = ownedShops.map((s) => s.shopId);
  const { data: members } = await supabase
    .from("profiles")
    .select("id, user_id, shop_id, display_name, role")
    .in("shop_id", shopIds)
    .order("role");

  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailByUserId = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));
  const shopNameById = new Map(ownedShops.map((s) => [s.shopId, s.shopName]));

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Shops Administration</h1>
      <p className="mt-1 text-sm text-muted">
        All {ownedShops.length} branches you own, combined and separately.
      </p>

      <div className="stagger mt-6 flex flex-wrap gap-4">
        <Stat label="Branches" value={String(ownedShops.length)} />
        <Stat label="Today (combined)" value={formatCurrency(combined.todayRevenue)} />
        <Stat label="Last 7 days (combined)" value={formatCurrency(combined.weekRevenue)} />
        <Stat label="Low stock (combined)" value={String(combined.lowStockCount)} />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">By branch</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="py-1.5 pr-3">Branch</th>
              <th className="py-1.5 pr-3">Today</th>
              <th className="py-1.5 pr-3">Last 7 days</th>
              <th className="py-1.5 pr-3">Low stock</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {branchData.map((b) => {
              const boundSwitch = switchShopAction.bind(null, b.shopId, "owner");
              return (
                <tr key={b.shopId} className="border-b border-hairline">
                  <td className="py-1.5 pr-3 text-ink">{b.shopName}</td>
                  <td className="py-1.5 pr-3 text-body">{formatCurrency(b.todayRevenue)}</td>
                  <td className="py-1.5 pr-3 text-body">{formatCurrency(b.weekRevenue)}</td>
                  <td className="py-1.5 pr-3">
                    {b.lowStock.length > 0 ? (
                      <Badge variant="warning">{b.lowStock.length}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    <form action={boundSwitch}>
                      <button
                        type="submit"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        View dashboard
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {combined.lowStockCount > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium text-muted">Low stock, all branches</h2>
          <div className="mt-2 flex flex-col gap-1">
            {branchData.flatMap((b) =>
              b.lowStock.map((v) => (
                <div
                  key={`${b.shopId}-${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-canvas-soft px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    {v.productName} — {v.label}{" "}
                    <span className="text-muted">({b.shopName})</span>
                  </span>
                  <Badge variant="warning">{v.stockQty} left</Badge>
                </div>
              )),
            )}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-medium text-muted">Staff across branches</h2>
      <div className="stagger mt-2 flex flex-col gap-3">
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-muted">No staff at any of your branches yet.</p>
        ) : (
          (members ?? []).map((m) => (
            <StaffRow
              key={m.id}
              profileId={m.id}
              displayName={m.display_name}
              email={emailByUserId.get(m.user_id) ?? "unknown"}
              role={m.role}
              currentShopId={m.shop_id}
              currentShopName={shopNameById.get(m.shop_id) ?? ""}
              otherShops={ownedShops.filter((s) => s.shopId !== m.shop_id)}
            />
          ))
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Add staff to a branch</h2>
      <div className="mt-2">
        <InviteForm shops={ownedShops} />
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
