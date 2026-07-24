import Link from "next/link";
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
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminReportsPage({
  ownedShops,
  searchParams,
}: {
  ownedShops: ShopMembership[];
  searchParams: { range?: string; from?: string; to?: string; branch?: string };
}) {
  const { from, to, preset } = resolveRange(searchParams);
  const supabase = await createClient();

  const selectedBranch =
    searchParams.branch && ownedShops.some((s) => s.shopId === searchParams.branch)
      ? searchParams.branch
      : "combined";
  const salesShopIds =
    selectedBranch === "combined" ? ownedShops.map((s) => s.shopId) : [selectedBranch];
  const rangeQuery = `&from=${searchParams.from ?? ""}&to=${searchParams.to ?? ""}`;

  // Sales-side metrics: concatenate raw rows across the selected shop(s)
  // before feeding compute.ts — those functions are shop-agnostic, so this
  // is all that's needed to produce a correctly "combined" result.
  const salesPerShop = await Promise.all(
    salesShopIds.map(async (shopId) => {
      const { data: sales } = await supabase
        .from("sales")
        .select("id, total, created_at")
        .eq("shop_id", shopId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .is("voided_at", null);
      const saleIds = (sales ?? []).map((s) => s.id);
      let saleItems: unknown[] = [];
      if (saleIds.length) {
        const { data } = await supabase
          .from("sale_items")
          .select(
            "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, category))",
          )
          .eq("shop_id", shopId)
          .in("sale_id", saleIds);
        saleItems = data ?? [];
      }
      const { data: receipts } = await supabase
        .from("stock_receipts")
        .select("supplier_id, quantity_added, unit_cost, suppliers(name)")
        .eq("shop_id", shopId)
        .gte("received_at", from.toISOString())
        .lt("received_at", to.toISOString());
      const { data: staffSales } = await supabase
        .from("sales")
        .select("total, created_by, voided_at")
        .eq("shop_id", shopId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString());
      return {
        sales: sales ?? [],
        saleItems: saleItems ?? [],
        receipts: receipts ?? [],
        staffSales: staffSales ?? [],
      };
    }),
  );

  const sales = salesPerShop.flatMap((r) => r.sales);
  const items = normalizeSaleItems(salesPerShop.flatMap((r) => r.saleItems));
  const receiptRows = normalizeReceipts(salesPerShop.flatMap((r) => r.receipts));
  const staffSales = salesPerShop.flatMap((r) => r.staffSales);

  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("shop_id", salesShopIds);

  const salesSummary = computeSalesSummary(sales);
  const revenueProfit = computeRevenueProfit(items);
  const bestSellers = computeBestSellers(items);
  const { byCategory, byNicotine } = computeSalesByCategory(items);
  const supplierActivity = computeSupplierActivity(receiptRows);
  const staffActivity = computeStaffActivity(staffSales, staffProfiles ?? []);

  // Inventory-side metrics are never blended across branches -- two
  // branches can have identically-named products, so a merged list would
  // be misleading. Always fetch and render per branch.
  const inventoryPerBranch = await Promise.all(
    ownedShops.map(async (s) => {
      const [{ data: variants }, { data: branchSales }] = await Promise.all([
        supabase
          .from("variants")
          .select(
            "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
          )
          .eq("shop_id", s.shopId),
        supabase
          .from("sales")
          .select("id")
          .eq("shop_id", s.shopId)
          .gte("created_at", from.toISOString())
          .lt("created_at", to.toISOString())
          .is("voided_at", null),
      ]);

      const branchSaleIds = (branchSales ?? []).map((row) => row.id);
      const { data: branchSaleItems } = branchSaleIds.length
        ? await supabase
            .from("sale_items")
            .select(
              "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, category))",
            )
            .eq("shop_id", s.shopId)
            .in("sale_id", branchSaleIds)
        : { data: [] as SaleItemRow[] };

      const variantRows = normalizeVariants(variants ?? []);
      const branchItems = normalizeSaleItems(branchSaleItems ?? []);

      return {
        shopId: s.shopId,
        shopName: s.shopName,
        lowStock: computeLowStock(variantRows),
        slowMovers: computeSlowMovers(variantRows, branchItems),
        inventoryValue: computeInventoryValue(variantRows),
      };
    }),
  );

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Reports</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <RangeLink range="today" current={preset} label="Today" extraParams={`&branch=${selectedBranch}`} />
        <RangeLink range="7d" current={preset} label="Last 7 days" extraParams={`&branch=${selectedBranch}`} />
        <RangeLink range="30d" current={preset} label="Last 30 days" extraParams={`&branch=${selectedBranch}`} />
        <form className="flex items-center gap-1" action="/reports">
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="branch" value={selectedBranch} />
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

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted">Sales for:</span>
        <BranchLink
          shopId="combined"
          label="All branches (combined)"
          current={selectedBranch}
          preset={preset}
          rangeQuery={rangeQuery}
        />
        {ownedShops.map((s) => (
          <BranchLink
            key={s.shopId}
            shopId={s.shopId}
            label={s.shopName}
            current={selectedBranch}
            preset={preset}
            rangeQuery={rangeQuery}
          />
        ))}
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
        <Table rows={byCategory.map((c) => [c.category, "", formatCurrency(c.revenue)])} />
        {byNicotine.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium uppercase text-muted">
              E-juice by nicotine strength
            </p>
            <Table rows={byNicotine.map((n) => [n.mg, "", formatCurrency(n.revenue)])} />
          </>
        )}
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

      <h2 className="mt-10 text-lg font-semibold text-ink">Inventory, by branch</h2>
      <p className="mt-1 text-xs text-muted">
        Never combined — two branches can carry identically-named products.
      </p>
      {inventoryPerBranch.map((b) => (
        <div key={b.shopId} className="mt-6 rounded-xl border border-hairline p-4">
          <h3 className="text-sm font-semibold text-ink">{b.shopName}</h3>

          <Section title="Low stock">
            {b.lowStock.length === 0 ? (
              <Empty text="Nothing is low on stock." />
            ) : (
              <Table
                rows={b.lowStock.map((v) => [
                  `${v.productName} — ${v.label}`,
                  `${v.stockQty} in stock`,
                  `threshold ${v.threshold}`,
                ])}
              />
            )}
          </Section>

          <Section title="Slow movers">
            {b.slowMovers.length === 0 ? (
              <Empty />
            ) : (
              <Table
                rows={b.slowMovers.map((v) => [
                  `${v.productName} — ${v.label}`,
                  `${v.quantitySold} sold`,
                  `${v.stockQty} in stock`,
                ])}
              />
            )}
          </Section>

          <Section title="Inventory value">
            <Stat label="Total" value={formatCurrency(b.inventoryValue.total)} />
            <Table
              rows={b.inventoryValue.byCategory.map((c) => [c.category, "", formatCurrency(c.value)])}
            />
          </Section>
        </div>
      ))}
    </main>
  );
}

function BranchLink({
  shopId,
  label,
  current,
  preset,
  rangeQuery,
}: {
  shopId: string;
  label: string;
  current: string;
  preset: string;
  rangeQuery: string;
}) {
  const active = current === shopId;
  const rangePart = preset === "custom" ? `&range=custom${rangeQuery}` : `&range=${preset}`;
  return (
    <Link
      href={`/reports?branch=${shopId}${rangePart}`}
      className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${active ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}
