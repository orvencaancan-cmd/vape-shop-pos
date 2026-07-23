const FEATURE_BOXES = [
  {
    title: "Inventory",
    items: [
      "Track specifics of your stock — flavor, strength, and size",
      "Stock updates the moment a sale is made",
      "See what's low before you run out",
    ],
  },
  {
    title: "Sales",
    items: [
      "A simple screen to ring up a sale — no training needed",
      "Search or tap to add items, then check out",
      "Totals and stock update as you go",
    ],
  },
  {
    title: "Reports",
    items: [
      "Revenue and profit, by day, week, or month",
      "Best sellers and slow movers",
      "Low stock and inventory value",
      "Staff activity",
    ],
  },
];

export function FeaturePanel({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {FEATURE_BOXES.map((box) => (
        <div key={box.title} className="rounded-xl border border-hairline bg-canvas px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{box.title}</h3>
            <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Real time
            </span>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {box.items.map((item) => (
              <li key={item} className="flex gap-1.5 text-xs leading-relaxed text-body">
                <span className="text-primary" aria-hidden="true">
                  –
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
