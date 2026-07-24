import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/reports/date-range";
import { fetchSingleShopReportData } from "@/lib/reports/fetch-single-shop";
import { formatCurrency } from "@/lib/currency";
import { RangeLink, Section, Stat, Empty, Table } from "./report-ui";
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

  const range = resolveRange(params);
  const { preset } = range;

  const supabase = await createClient();
  const {
    salesSummary,
    revenueProfit,
    bestSellers,
    byCategory,
    byNicotine,
    lowStock,
    slowMovers,
    inventoryValue,
    supplierActivity,
    staffActivity,
  } = await fetchSingleShopReportData(supabase, profile.shopId, range);

  const exportQuery = new URLSearchParams(
    Object.entries({ range: preset, from: params.from, to: params.to }).filter(
      ([, v]) => v != null,
    ) as [string, string][],
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
