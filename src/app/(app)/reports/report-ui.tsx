import Link from "next/link";
import type { SaleItemRow, VariantRow, ReceiptRow } from "@/lib/reports/compute";

export function RangeLink({
  range,
  current,
  label,
  extraParams,
}: {
  range: string;
  current: string;
  label: string;
  extraParams?: string;
}) {
  const active = current === range;
  return (
    <Link
      href={`/reports?range=${range}${extraParams ?? ""}`}
      className={`rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas-soft px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

export function Empty({ text = "No data for this period." }: { text?: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

export function Table({ rows }: { rows: [string, string, string][] }) {
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

export function normalizeSaleItems(rows: unknown[]): SaleItemRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    sale_id: r.sale_id as string,
    variant_id: r.variant_id as string,
    quantity: r.quantity as number,
    unit_price: r.unit_price as number,
    unit_cost: r.unit_cost as number,
    variants: normalizeOne(r.variants) as SaleItemRow["variants"],
  }));
}

export function normalizeVariants(rows: unknown[]): VariantRow[] {
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

export function normalizeReceipts(rows: unknown[]): ReceiptRow[] {
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
