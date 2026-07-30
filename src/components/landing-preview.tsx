"use client";

import { useEffect, useState } from "react";
import { Stat } from "@/components/ui/stat";
import { SalesChart } from "@/components/sales-chart";
import { formatCurrency } from "@/lib/currency";

const TABS = ["sell", "dashboard", "reports", "inventory"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  sell: "Sales",
  dashboard: "Dashboard",
  reports: "Reports",
  inventory: "Inventory",
};

const WEEK_DATA = [
  { date: "2026-07-23", revenue: 3200 },
  { date: "2026-07-24", revenue: 4100 },
  { date: "2026-07-25", revenue: 2800 },
  { date: "2026-07-26", revenue: 5600 },
  { date: "2026-07-27", revenue: 3900 },
  { date: "2026-07-28", revenue: 4700 },
  { date: "2026-07-29", revenue: 6200 },
];

export function LandingPreview() {
  const [tab, setTab] = useState<Tab>("sell");
  const [userSelected, setUserSelected] = useState(false);

  useEffect(() => {
    if (userSelected) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setTab((current) => TABS[(TABS.indexOf(current) + 1) % TABS.length]);
    }, 4200);
    return () => clearInterval(id);
  }, [userSelected]);

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

      <div className="flex gap-1 bg-canvas-soft px-3 pt-2.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setUserSelected(true);
            }}
            className={`rounded-t-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === t ? "bg-canvas text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="min-h-[380px] bg-canvas p-5">
        {tab === "sell" && <SellPreview />}
        {tab === "dashboard" && <DashboardPreview />}
        {tab === "reports" && <ReportsPreview />}
        {tab === "inventory" && <InventoryPreview />}
      </div>
    </div>
  );
}

function SellPreview() {
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

function DashboardPreview() {
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

function ReportsPreview() {
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

function InventoryPreview() {
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
