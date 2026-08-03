import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/reports/date-range";
import { fetchAdminReportData, resolveSelectedBranch } from "@/lib/reports/fetch-admin";
import { formatCurrency } from "@/lib/currency";
import { RangeLink, Stat, Empty, Table, PromosDetail } from "./report-ui";
import { CustomRangeForm } from "./custom-range-form";
import { CollapsibleSection } from "./collapsible-section";
import { SaleDetailTable } from "./sale-detail-table";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminReportsPage({
  ownedShops,
  searchParams,
}: {
  ownedShops: ShopMembership[];
  searchParams: { range?: string; from?: string; to?: string; branch?: string };
}) {
  const range = resolveRange(searchParams);
  const { preset } = range;
  const supabase = await createClient();

  const selectedBranch = resolveSelectedBranch(searchParams.branch, ownedShops);
  const rangeQuery = `&from=${searchParams.from ?? ""}&to=${searchParams.to ?? ""}`;

  const {
    salesSummary,
    paymentBreakdown,
    discounts,
    saleDiscounts,
    loyaltySummary,
    salesDetail,
    revenueProfit,
    projectedRevenueProfit,
    bestSellers,
    byCategory,
    byNicotine,
    supplierActivity,
    staffActivity,
    inventoryPerBranch,
    expenses,
    expenseSummary,
  } = await fetchAdminReportData(supabase, ownedShops, selectedBranch, range);

  const exportQuery = new URLSearchParams(
    Object.entries({
      range: preset,
      from: searchParams.from,
      to: searchParams.to,
      branch: selectedBranch,
    }).filter(([, v]) => v != null) as [string, string][],
  ).toString();

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl">Reports</h1>
        <a
          href={`/api/reports/export?${exportQuery}`}
          className="rounded-lg bg-canvas-strong px-3 py-1.5 text-xs text-body transition-colors hover:text-ink"
        >
          Download Excel
        </a>
      </div>

      <div className="sticky top-0 z-10 mt-4 flex flex-col gap-2 border-b border-hairline bg-canvas-soft/95 py-3 text-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <RangeLink range="today" current={preset} label="Today" extraParams={`&branch=${selectedBranch}`} />
          <RangeLink range="7d" current={preset} label="Last 7 days" extraParams={`&branch=${selectedBranch}`} />
          <RangeLink range="30d" current={preset} label="Last 30 days" extraParams={`&branch=${selectedBranch}`} />
          <CustomRangeForm branch={selectedBranch} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <CollapsibleSection title="Sales summary" defaultOpen>
        <Stat label="Sales" value={salesSummary.count.toString()} />
        <Stat label="Cash" value={formatCurrency(paymentBreakdown.cash)} />
        <Stat label="GCash" value={formatCurrency(paymentBreakdown.gcash)} />
        <Stat label="Total" value={formatCurrency(salesSummary.revenue)} />
      </CollapsibleSection>

      <CollapsibleSection title="Sales detail" collapsible={false}>
        <SaleDetailTable sales={salesDetail} />
      </CollapsibleSection>

      <CollapsibleSection title="Revenue & profit" defaultOpen>
        <Stat label="Revenue" value={formatCurrency(revenueProfit.revenue)} />
        <Stat label="Discounts" value={formatCurrency(discounts.total)} />
        <Stat label="Cost of goods" value={formatCurrency(revenueProfit.cost)} />
        <Stat label="Expenses" value={formatCurrency(expenseSummary.total)} />
        <Stat
          label="Profit"
          value={formatCurrency(
            revenueProfit.revenue -
              discounts.total -
              saleDiscounts.total -
              revenueProfit.cost -
              expenseSummary.total,
          )}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Projected revenue & profit">
        <p className="w-full text-xs text-muted">
          If every unit currently in stock sold at its listed price — a snapshot of inventory, not a
          forecast based on sales history.
        </p>
        <Stat label="Revenue" value={formatCurrency(projectedRevenueProfit.revenue)} />
        <Stat label="Cost of goods" value={formatCurrency(projectedRevenueProfit.cost)} />
        <Stat label="Profit" value={formatCurrency(projectedRevenueProfit.profit)} />
      </CollapsibleSection>

      <CollapsibleSection title="Best sellers">
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
      </CollapsibleSection>

      <CollapsibleSection title="Sales by category">
        <Table rows={byCategory.map((c) => [c.category, "", formatCurrency(c.revenue)])} />
      </CollapsibleSection>

      <CollapsibleSection title="Sales by nicotine strength">
        {byNicotine.length === 0 ? (
          <Empty />
        ) : (
          <Table rows={byNicotine.map((n) => [n.mg, "", formatCurrency(n.revenue)])} />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Supplier activity">
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
      </CollapsibleSection>

      <CollapsibleSection title="Expenses">
        {expenses.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={expenses.map((e) => [
              new Date(e.createdAt).toLocaleDateString(),
              e.category + (e.note ? ` — ${e.note}` : ""),
              formatCurrency(e.amount),
            ])}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Staff activity">
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
      </CollapsibleSection>

      <CollapsibleSection title="Promos">
        <PromosDetail loyaltySummary={loyaltySummary} saleDiscounts={saleDiscounts} />
      </CollapsibleSection>

      <h2 className="mt-10 text-lg font-semibold text-ink">Inventory, by branch</h2>
      <p className="mt-1 text-xs text-muted">
        Never combined — two branches can carry identically-named products.
      </p>
      {inventoryPerBranch.map((b) => (
        <div key={b.shopId} className="mt-6 rounded-xl border border-hairline p-4">
          <h3 className="text-sm font-semibold text-ink">{b.shopName}</h3>

          <CollapsibleSection title="Low stock">
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
          </CollapsibleSection>

          <CollapsibleSection title="Slow movers">
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
          </CollapsibleSection>

          <CollapsibleSection title="Inventory value">
            <Stat label="Total" value={formatCurrency(b.inventoryValue.total)} />
            <Table
              rows={b.inventoryValue.byCategory.map((c) => [c.category, "", formatCurrency(c.value)])}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Projected revenue & profit">
            <p className="w-full text-xs text-muted">
              If every unit currently in stock sold at its listed price — a snapshot of this branch&apos;s
              inventory, not a forecast based on sales history.
            </p>
            <Stat label="Revenue" value={formatCurrency(b.projectedRevenueProfit.revenue)} />
            <Stat label="Cost of goods" value={formatCurrency(b.projectedRevenueProfit.cost)} />
            <Stat label="Profit" value={formatCurrency(b.projectedRevenueProfit.profit)} />
          </CollapsibleSection>
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
      scroll={false}
      className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${active ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}
