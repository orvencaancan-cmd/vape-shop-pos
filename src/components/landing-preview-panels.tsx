import type { ReactNode } from "react";
import { Stat } from "@/components/ui/stat";
import { SalesChart } from "@/components/sales-chart";
import { formatCurrency } from "@/lib/currency";

export type SlideKey = "sell" | "inventory" | "reports" | "staff" | "dashboard";

export const SLIDES: { key: SlideKey; tabLabel: string; word: string; headline2: string }[] = [
  { key: "sell", tabLabel: "Sales", word: "sales.", headline2: "Ring up sales in seconds." },
  {
    key: "inventory",
    tabLabel: "Inventory",
    word: "stock.",
    headline2: "See what's low before you run out.",
  },
  {
    key: "reports",
    tabLabel: "Reports",
    word: "profit.",
    headline2: "Know your best sellers, instantly.",
  },
  { key: "staff", tabLabel: "Staff", word: "team.", headline2: "Give staff safe, limited access." },
  {
    key: "dashboard",
    tabLabel: "Dashboard",
    word: "business.",
    headline2: "Everything at a glance, every day.",
  },
];

const WEEK_DATA = [
  { date: "2026-07-23", revenue: 3200 },
  { date: "2026-07-24", revenue: 4100 },
  { date: "2026-07-25", revenue: 2800 },
  { date: "2026-07-26", revenue: 5600 },
  { date: "2026-07-27", revenue: 3900 },
  { date: "2026-07-28", revenue: 4700 },
  { date: "2026-07-29", revenue: 6200 },
];

export function PreviewShell({
  tabs,
  activeKey,
  onSelect,
  children,
}: {
  tabs: { key: SlideKey; tabLabel: string }[];
  activeKey: SlideKey;
  onSelect: (key: SlideKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-canvas-soft shadow-sm">
      <div className="flex items-center gap-2 border-b border-hairline bg-canvas-strong px-3.5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-hairline" />
        <span className="h-2 w-2 rounded-full bg-hairline" />
        <span className="h-2 w-2 rounded-full bg-hairline" />
        <span className="ml-2 flex-1 truncate rounded-md border border-hairline bg-canvas-soft px-2.5 py-1 text-xs text-muted">
          vapestockva.com
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-canvas-soft px-3 pt-2.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(t.key)}
            className={`shrink-0 rounded-t-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              activeKey === t.key ? "bg-canvas text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {t.tabLabel}
          </button>
        ))}
      </div>

      <div className="min-h-[380px] bg-canvas p-5">{children}</div>
    </div>
  );
}

export function SellPreview() {
  return (
    <div className="animate-fade-in-up">
      <div className="rounded-lg border border-hairline bg-canvas-soft px-3 py-2 text-sm text-muted">
        Search products…
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-hairline bg-canvas-soft p-3">
          <p className="text-sm font-medium text-ink">Blue Razz</p>
          <p className="text-xs text-muted">Blue Razz Ice · 6mg · 30ml</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(15)}</p>
          <p className="text-xs text-muted">17 in stock</p>
        </div>
        <div className="rounded-lg border border-hairline bg-canvas-soft p-3">
          <p className="text-sm font-medium text-ink">Lava Flow</p>
          <p className="text-xs text-muted">Lava Flow · 3mg · 60ml</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(22)}</p>
          <p className="text-xs text-muted">8 in stock</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-body">Blue Razz Ice · 6mg · 30ml × 1</span>
          <span className="text-ink">{formatCurrency(15)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-body">Lava Flow · 3mg · 60ml × 1</span>
          <span className="text-ink">{formatCurrency(22)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm font-medium text-ink">
          <span>Total</span>
          <span>{formatCurrency(37)}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-center text-sm text-on-primary">
            Cash
          </span>
          <span className="flex-1 rounded-lg bg-canvas-strong px-3 py-1.5 text-center text-sm text-body">
            GCash
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardPreview() {
  const weekTotal = WEEK_DATA.reduce((sum, d) => sum + d.revenue, 0);
  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-wrap gap-3">
        <Stat label="Today" value={formatCurrency(6200)} />
        <Stat label="Sales" value="18" />
        <Stat label="Cash" value={formatCurrency(3800)} />
        <Stat label="GCash" value={formatCurrency(2400)} />
      </div>
      <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Last 7 days</p>
          <span className="text-xs text-muted">{formatCurrency(weekTotal)}</span>
        </div>
        <div className="mt-3">
          <SalesChart data={WEEK_DATA} barHeight="h-16" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-hairline bg-canvas-soft p-4">
        <p className="text-sm font-medium text-ink">Needs attention</p>
        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          2 items low
        </span>
      </div>
    </div>
  );
}

export function ReportsPreview() {
  const rows: [string, string, string][] = [
    ["Blue Razz — Blue Razz Ice", "24 sold", formatCurrency(360)],
    ["Lava Flow — 3mg · 60ml", "19 sold", formatCurrency(418)],
    ["Oneo Pod Cartridge", "31 sold", formatCurrency(279)],
  ];
  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-wrap gap-3">
        <Stat label="Sales" value="142" />
        <Stat label="Cash" value={formatCurrency(58200)} />
        <Stat label="GCash" value={formatCurrency(41900)} />
        <Stat label="Total" value={formatCurrency(100100)} />
      </div>
      <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4">
        <p className="text-sm font-medium text-ink">Best sellers</p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-hairline last:border-0">
                <td className="py-1.5 pr-3 text-ink">{r[0]}</td>
                <td className="py-1.5 pr-3 text-muted">{r[1]}</td>
                <td className="py-1.5 text-right text-ink">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryPreview() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-3">
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
        <h3 className="heading text-sm">Naked 100</h3>
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
          <span className="text-body">Blue Razz Ice · 6mg · 30ml</span>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            17 in stock
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-hairline pt-1.5 text-sm">
          <span className="text-body">Blue Razz Ice · 3mg · 30ml</span>
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            4 in stock
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
        <h3 className="heading text-sm">Vapetasia</h3>
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
          <span className="text-body">Lava Flow · 3mg · 60ml</span>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            8 in stock
          </span>
        </div>
      </div>
    </div>
  );
}

export function StaffPreview() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Staff</p>
        <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary">
          Invite staff
        </span>
      </div>
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Jamie Rivera</span>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
            Owner
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
          <span className="text-ink">Alex Cruz</span>
          <span className="rounded-full bg-canvas-strong px-2 py-0.5 text-xs font-medium text-body">
            Staff
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-sm">
          <span className="text-ink">Sam Torres</span>
          <span className="rounded-full bg-canvas-strong px-2 py-0.5 text-xs font-medium text-body">
            Staff
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-hairline bg-canvas-soft p-4 text-xs text-muted">
        Staff can sell and restock — they can&apos;t see prices, reports, or billing.
      </div>
    </div>
  );
}

export const PANEL_COMPONENTS: Record<SlideKey, () => React.JSX.Element> = {
  sell: SellPreview,
  inventory: InventoryPreview,
  reports: ReportsPreview,
  staff: StaffPreview,
  dashboard: DashboardPreview,
};
