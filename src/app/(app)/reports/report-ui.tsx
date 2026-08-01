import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import type { SaleDetail } from "@/lib/reports/compute";
import { Section, Stat } from "@/components/ui/stat";

export { Section, Stat };

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

export function Empty({ text = "No data for this period." }: { text?: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", gcash: "GCash" };

export function SaleDetailTable({ sales }: { sales: SaleDetail[] }) {
  const rows = sales.flatMap((s) =>
    s.lines.map((line) => ({
      saleId: s.saleId,
      time: new Date(s.createdAt).toLocaleString(),
      item: `${line.brand ? `${line.brand} — ` : ""}${line.productName} — ${line.label}`,
      quantity: line.quantity,
      price: line.lineTotal,
      saleTotal: s.total,
      note: s.note,
      paymentMethod: PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod,
    })),
  );

  if (rows.length === 0) return <Empty />;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs text-muted">
            <th className="py-1.5 pr-3 text-left font-normal">Time</th>
            <th className="py-1.5 pr-3 text-left font-normal">Item</th>
            <th className="py-1.5 pr-3 text-right font-normal">Qty</th>
            <th className="py-1.5 pr-3 text-right font-normal">Price</th>
            <th className="py-1.5 pr-3 text-right font-normal">Sale total</th>
            <th className="py-1.5 pr-3 text-left font-normal">Notes</th>
            <th className="py-1.5 text-right font-normal">Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.saleId}-${i}`} className="border-b border-hairline last:border-0">
              <td className="py-1.5 pr-3 text-muted">{r.time}</td>
              <td className="py-1.5 pr-3 text-ink">{r.item}</td>
              <td className="py-1.5 pr-3 text-right text-ink">{r.quantity}</td>
              <td className="py-1.5 pr-3 text-right text-ink">{formatCurrency(r.price)}</td>
              <td className="py-1.5 pr-3 text-right text-ink">{formatCurrency(r.saleTotal)}</td>
              <td className="py-1.5 pr-3 text-warning">{r.note}</td>
              <td className="py-1.5 text-right text-body">{r.paymentMethod}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
