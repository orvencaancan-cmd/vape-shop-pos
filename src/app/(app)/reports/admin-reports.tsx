import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/reports/date-range";
import { fetchAdminReportData, resolveSelectedBranch } from "@/lib/reports/fetch-admin";
import { formatCurrency } from "@/lib/currency";
import { RangeLink, Section, Stat, Empty, Table, SaleDetailTable } from "./report-ui";
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
    loyaltySummary,
    salesDetail,
    revenueProfit,
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
        <Stat label="Cash" value={formatCurrency(paymentBreakdown.cash)} />
        <Stat label="GCash" value={formatCurrency(paymentBreakdown.gcash)} />
        <Stat label="Total" value={formatCurrency(salesSummary.revenue)} />
      </Section>

      <Section title="Sales detail">
        <SaleDetailTable sales={salesDetail} />
      </Section>

      <Section title="Loyalty">
        <Stat label="Credit earned" value={formatCurrency(loyaltySummary.earned)} />
        <Stat label="Credit redeemed" value={formatCurrency(loyaltySummary.redeemed)} />
        <Stat label="Credit forfeited" value={formatCurrency(loyaltySummary.forfeited)} />
      </Section>

      <Section title="Revenue & profit">
        <Stat label="Revenue" value={formatCurrency(revenueProfit.revenue)} />
        <Stat label="Discounts" value={formatCurrency(discounts.total)} />
        <Stat label="Cost of goods" value={formatCurrency(revenueProfit.cost)} />
        <Stat label="Expenses" value={formatCurrency(expenseSummary.total)} />
        <Stat
          label="Profit"
          value={formatCurrency(
            revenueProfit.revenue - discounts.total - revenueProfit.cost - expenseSummary.total,
          )}
        />
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

      <Section title="Expenses">
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
