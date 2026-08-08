"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { matchesSearch } from "@/lib/search-match";

type Customer = { name: string | null; phone: string; creditBalance: number };

export function CustomerList({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    return matchesSearch(`${c.name ?? ""} ${c.phone}`, search);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-canvas-soft px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <a
          href="/api/customers/export"
          className="shrink-0 rounded-lg bg-canvas-strong px-3 py-2.5 text-sm text-body transition-colors hover:text-ink"
        >
          Download Excel
        </a>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-hairline rounded-xl border border-hairline bg-canvas-soft">
        {filtered.map((c) => (
          <div key={c.phone} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{c.name || "No name on file"}</p>
              <p className="text-xs text-muted">{c.phone}</p>
            </div>
            <span className="shrink-0 rounded-full bg-canvas-strong px-2 py-0.5 text-xs font-medium text-body">
              {formatCurrency(c.creditBalance)} credit
            </span>
          </div>
        ))}
        {customers.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            No customers registered for store credit yet.
          </p>
        )}
        {customers.length > 0 && filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">No customers match.</p>
        )}
      </div>
    </div>
  );
}
