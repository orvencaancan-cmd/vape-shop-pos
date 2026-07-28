import { formatCurrency } from "@/lib/currency";

export function SalesChart({
  data,
  barHeight = "h-24",
}: {
  data: { date: string; revenue: number }[];
  barHeight?: string;
}) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const step = data.length > 10 ? Math.ceil(data.length / 6) : 1;

  return (
    <div className="flex items-end gap-1">
      {data.map((d, i) => {
        const showLabel = i % step === 0 || i === data.length - 1;
        const label =
          data.length > 10
            ? new Date(`${d.date}T00:00:00Z`).getUTCDate().toString()
            : new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className={`flex w-full items-end ${barHeight}`}>
              <div
                className="w-full rounded-t-sm bg-primary/80 transition-all"
                style={{ height: `${Math.max((d.revenue / max) * 100, d.revenue > 0 ? 4 : 1)}%` }}
                title={`${d.date}: ${formatCurrency(d.revenue)}`}
              />
            </div>
            <span className="text-[10px] text-muted">{showLabel ? label : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
