import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/reports/date-range";
import {
  computeSalesSummary,
  computeRevenueProfit,
  computeBestSellers,
  computeSalesByCategory,
  computeLowStock,
  computeSlowMovers,
  computeInventoryValue,
  computeSupplierActivity,
  computeStaffActivity,
  type SaleItemRow,
} from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import {
  RangeLink,
  Section,
  Stat,
  Empty,
  Table,
  normalizeSaleItems,
  normalizeVariants,
  normalizeReceipts,
} from "./report-ui";
import { AdminReportsPage } from "./admin-reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; branch?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  const params = await searchParams;

  if (profile.inAdminOverview) {
    const activeOwnedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    return <AdminReportsPage ownedShops={activeOwnedShops} searchParams={params} />;
  }
  if (profile.role !== "owner") redirect("/sell");

  const { from, to, preset } = resolveRange(params);

  const supabase = await createClient();

  const { data: sales } = await supabase
    .from("sales")
    .select("id, total, created_at")
    .eq("shop_id", profile.shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .is("voided_at", null);

  const saleIds = (sales ?? []).map((s) => s.id);

  const { data: saleItems } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select(
          "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, category))",
        )
        .eq("shop_id", profile.shopId)
        .in("sale_id", saleIds)
    : { data: [] as SaleItemRow[] };

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
    )
    .eq("shop_id", profile.shopId);

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("supplier_id, quantity_added, unit_cost, suppliers(name)")
    .eq("shop_id", profile.shopId)
    .gte("received_at", from.toISOString())
    .lt("received_at", to.toISOString());

  const { data: staffSales } = await supabase
    .from("sales")
    .select("total, created_by, voided_at")
    .eq("shop_id", profile.shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());

  // No shop_id filter: this is purely an id -> display_name lookup for
  // computeStaffActivity below, keyed off the shop-scoped staffSales list.
  // A staff member who was later transferred to another owned branch would
  // otherwise fail this lookup (their profiles.shop_id no longer matches
  // this shop) and show as "Unnamed staff" on their own historical sales.
  // RLS's profiles_select already limits rows to shops this caller belongs
  // to, so no cross-tenant data is exposed by dropping the filter.
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const items = normalizeSaleItems(saleItems ?? []);
  const variantRows = normalizeVariants(variants ?? []);
  const receiptRows = normalizeReceipts(receipts ?? []);

  const salesSummary = computeSalesSummary(sales ?? []);
  const revenueProfit = computeRevenueProfit(items);
  const bestSellers = computeBestSellers(items);
  const { byCategory, byNicotine } = computeSalesByCategory(items);
  const lowStock = computeLowStock(variantRows);
  const slowMovers = computeSlowMovers(variantRows, items);
  const inventoryValue = computeInventoryValue(variantRows);
  const supplierActivity = computeSupplierActivity(receiptRows);
  const staffActivity = computeStaffActivity(staffSales ?? [], staffProfiles ?? []);

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Reports</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <RangeLink range="today" current={preset} label="Today" />
        <RangeLink range="7d" current={preset} label="Last 7 days" />
        <RangeLink range="30d" current={preset} label="Last 30 days" />
        <form className="flex items-center gap-1" action="/reports">
          <input type="hidden" name="range" value="custom" />
          <input
            type="date"
            name="from"
            className="rounded border border-hairline bg-canvas px-2 py-1 text-xs text-ink"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            name="to"
            className="rounded border border-hairline bg-canvas px-2 py-1 text-xs text-ink"
          />
          <button className="rounded bg-primary px-2 py-1 text-xs text-on-primary hover:bg-primary-active">
            Go
          </button>
        </form>
      </div>

      <Section title="Sales summary">
        <Stat label="Sales" value={salesSummary.count.toString()} />
        <Stat label="Revenue" value={formatCurrency(salesSummary.revenue)} />
      </Section>

      <Section title="Revenue & profit">
        <Stat label="Revenue" value={formatCurrency(revenueProfit.revenue)} />
        <Stat label="Cost of goods" value={formatCurrency(revenueProfit.cost)} />
        <Stat label="Profit" value={formatCurrency(revenueProfit.profit)} />
      </Section>

      <Section title="Best sellers">
        {bestSellers.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={bestSellers.map((b) => [
              `${b.productName} — ${b.label}`,
              `${b.quantity} sold`,
              formatCurrency(b.revenue),
            ])}
          />
        )}
      </Section>

      <Section title="Sales by category">
        <Table
          rows={byCategory.map((c) => [c.category, "", formatCurrency(c.revenue)])}
        />
        {byNicotine.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium uppercase text-muted">
              E-juice by nicotine strength
            </p>
            <Table rows={byNicotine.map((n) => [n.mg, "", formatCurrency(n.revenue)])} />
          </>
        )}
      </Section>

      <Section title="Low stock">
        {lowStock.length === 0 ? (
          <Empty text="Nothing is low on stock." />
        ) : (
          <Table
            rows={lowStock.map((v) => [
              `${v.productName} — ${v.label}`,
              `${v.stockQty} in stock`,
              `threshold ${v.threshold}`,
            ])}
          />
        )}
      </Section>

      <Section title="Slow movers">
        {slowMovers.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={slowMovers.map((v) => [
              `${v.productName} — ${v.label}`,
              `${v.quantitySold} sold`,
              `${v.stockQty} in stock`,
            ])}
          />
        )}
      </Section>

      <Section title="Inventory value">
        <Stat label="Total" value={formatCurrency(inventoryValue.total)} />
        <Table rows={inventoryValue.byCategory.map((c) => [c.category, "", formatCurrency(c.value)])} />
      </Section>

      <Section title="Supplier activity">
        {supplierActivity.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={supplierActivity.map((s) => [
              s.name,
              `${s.quantity} received`,
              formatCurrency(s.cost),
            ])}
          />
        )}
      </Section>

      <Section title="Staff activity">
        {staffActivity.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={staffActivity.map((s) => [
              s.name,
              `${s.count} sale${s.count === 1 ? "" : "s"} · avg ${formatCurrency(s.averageSale)}${
                s.voidedCount > 0 ? ` · ${s.voidedCount} voided` : ""
              }`,
              formatCurrency(s.revenue),
            ])}
          />
        )}
      </Section>
    </main>
  );
}
