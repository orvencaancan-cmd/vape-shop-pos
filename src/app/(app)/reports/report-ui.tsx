import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import type { SaleDetail } from "@/lib/reports/compute";

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

const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", gcash: "GCash" };

export function SaleDetailList({ sales }: { sales: SaleDetail[] }) {
  if (sales.length === 0) return <Empty />;
  return (
    <div className="flex w-full flex-col gap-3">
      {sales.map((s) => (
        <div key={s.saleId} className="rounded-xl border border-hairline bg-canvas-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink">
              {new Date(s.createdAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-canvas-strong px-2 py-0.5 text-xs text-body">
                {PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}
              </span>
              <span className="text-sm font-semibold text-ink">{formatCurrency(s.total)}</span>
            </div>
          </div>
          <ul className="mt-2 flex flex-col gap-1 border-t border-hairline pt-2">
            {s.lines.map((line, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs text-body">
                <span>
                  {line.brand ? `${line.brand} — ` : ""}
                  {line.productName} — {line.label} × {line.quantity}
                </span>
                <span className="shrink-0 text-muted">{formatCurrency(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
