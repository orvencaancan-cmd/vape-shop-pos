import Link from "next/link";
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
  type VariantRow,
  type ReceiptRow,
} from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/sell");

  const params = await searchParams;
  const { from, to, preset } = resolveRange(params);

  const supabase = await createClient();

  const { data: sales } = await supabase
    .from("sales")
    .select("id, total, created_at")
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
        .in("sale_id", saleIds)
    : { data: [] as SaleItemRow[] };

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
    );

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("supplier_id, quantity_added, unit_cost, suppliers(name)")
    .gte("received_at", from.toISOString())
    .lt("received_at", to.toISOString());

  const { data: staffSales } = await supabase
    .from("sales")
    .select("total, created_by, voided_at")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());

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

function RangeLink({
  range,
  current,
  label,
}: {
  range: string;
  current: string;
  label: string;
}) {
  const active = current === range;
  return (
    <Link
      href={`/reports?range=${range}`}
      className={`rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-4">{children}</div>
    </section>
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

function Empty({ text = "No data for this period." }: { text?: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-3 text-ink">{r[0]}</td>
              <td className="py-1.5 pr-3 text-muted">{r[1]}</td>
              <td className="py-1.5 text-right text-ink">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function normalizeSaleItems(rows: unknown[]): SaleItemRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    sale_id: r.sale_id as string,
    variant_id: r.variant_id as string,
    quantity: r.quantity as number,
    unit_price: r.unit_price as number,
    unit_cost: r.unit_cost as number,
    variants: normalizeOne(r.variants) as SaleItemRow["variants"],
  }));
}

function normalizeVariants(rows: unknown[]): VariantRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    flavor: r.flavor as string | null,
    nicotine_mg: r.nicotine_mg as number | null,
    size: r.size as string | null,
    for_device: r.for_device as string | null,
    ohms: r.ohms != null ? Number(r.ohms) : null,
    stock_qty: r.stock_qty as number,
    low_stock_threshold: r.low_stock_threshold as number,
    cost: r.cost as number,
    product_id: r.product_id as string,
    products: normalizeOne(r.products) as VariantRow["products"],
  }));
}

function normalizeReceipts(rows: unknown[]): ReceiptRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    supplier_id: r.supplier_id as string | null,
    quantity_added: r.quantity_added as number,
    unit_cost: r.unit_cost as number | null,
    suppliers: normalizeOne(r.suppliers) as ReceiptRow["suppliers"],
  }));
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
