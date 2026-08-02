import Link from "next/link";
import { Section, Stat } from "@/components/ui/stat";
import { formatCurrency } from "@/lib/currency";

export { Section, Stat };

const PROMO_LABEL = "text-xs font-medium uppercase text-muted";

export function PromosDetail({
  loyaltySummary,
  saleDiscounts,
}: {
  loyaltySummary: { earned: number; redeemed: number; forfeited: number };
  saleDiscounts: { total: number };
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <p className={PROMO_LABEL}>Loyalty Promo</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Stat label="Credit earned" value={formatCurrency(loyaltySummary.earned)} />
          <Stat label="Credit redeemed" value={formatCurrency(loyaltySummary.redeemed)} />
          <Stat label="Credit forfeited" value={formatCurrency(loyaltySummary.forfeited)} />
        </div>
      </div>
      <div>
        <p className={PROMO_LABEL}>Discount Promo</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Stat label="Discount promo" value={formatCurrency(saleDiscounts.total)} />
        </div>
      </div>
    </div>
  );
}

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
