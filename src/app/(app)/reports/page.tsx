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
  type SaleItemRow,
  type VariantRow,
  type ReceiptRow,
} from "@/lib/reports/compute";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/sell");

  const params = await searchParams;
  const { from, to, preset } = resolveRange(params);

  const supabase = await createClient();

  const { data: sales } = await supabase
    .from("sales")
    .select("id, total, created_at")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());

  const saleIds = (sales ?? []).map((s) => s.id);

  const { data: saleItems } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select(
          "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, product_id, products(name, category))",
        )
        .in("sale_id", saleIds)
    : { data: [] as SaleItemRow[] };

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, flavor, nicotine_mg, size, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
    );

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("supplier_id, quantity_added, unit_cost, suppliers(name)")
    .gte("received_at", from.toISOString())
    .lt("received_at", to.toISOString());

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <RangeLink range="today" current={preset} label="Today" />
        <RangeLink range="7d" current={preset} label="Last 7 days" />
        <RangeLink range="30d" current={preset} label="Last 30 days" />
        <form className="flex items-center gap-1" action="/reports">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <span className="text-slate-400">to</span>
          <input type="date" name="to" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <button className="rounded bg-slate-900 px-2 py-1 text-xs text-white">Go</button>
        </form>
      </div>

      <Section title="Sales summary">
        <Stat label="Sales" value={salesSummary.count.toString()} />
        <Stat label="Revenue" value={`$${salesSummary.revenue.toFixed(2)}`} />
      </Section>

      <Section title="Revenue & profit">
        <Stat label="Revenue" value={`$${revenueProfit.revenue.toFixed(2)}`} />
        <Stat label="Cost of goods" value={`$${revenueProfit.cost.toFixed(2)}`} />
        <Stat label="Profit" value={`$${revenueProfit.profit.toFixed(2)}`} />
      </Section>

      <Section title="Best sellers">
        {bestSellers.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={bestSellers.map((b) => [
              `${b.productName} — ${b.label}`,
              `${b.quantity} sold`,
              `$${b.revenue.toFixed(2)}`,
            ])}
          />
        )}
      </Section>

      <Section title="Sales by category">
        <Table
          rows={byCategory.map((c) => [c.category, "", `$${c.revenue.toFixed(2)}`])}
        />
        {byNicotine.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium uppercase text-slate-400">
              E-juice by nicotine strength
            </p>
            <Table rows={byNicotine.map((n) => [n.mg, "", `$${n.revenue.toFixed(2)}`])} />
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
        <Stat label="Total" value={`$${inventoryValue.total.toFixed(2)}`} />
        <Table rows={inventoryValue.byCategory.map((c) => [c.category, "", `$${c.value.toFixed(2)}`])} />
      </Section>

      <Section title="Supplier activity">
        {supplierActivity.length === 0 ? (
          <Empty />
        ) : (
          <Table
            rows={supplierActivity.map((s) => [
              s.name,
              `${s.quantity} received`,
              `$${s.cost.toFixed(2)}`,
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
      className={`rounded-md px-3 py-1.5 ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
    >
      {label}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-slate-500">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Empty({ text = "No data for this period." }: { text?: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 text-slate-800">{r[0]}</td>
              <td className="py-1.5 pr-3 text-slate-500">{r[1]}</td>
              <td className="py-1.5 text-right text-slate-800">{r[2]}</td>
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
