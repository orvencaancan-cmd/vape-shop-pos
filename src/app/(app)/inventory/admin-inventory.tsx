"use client";

import { useState } from "react";
import { groupByBrand } from "@/lib/group-by-brand";
import { matchesSearch } from "@/lib/search-match";
import { categoryLabel } from "@/lib/inventory/product-categories";
import type { AdminInventoryItem } from "@/lib/inventory/fetch-admin-inventory";

export function AdminInventoryPage({
  items,
  branches,
  categories,
}: {
  items: AdminInventoryItem[];
  branches: { shopId: string; shopName: string }[];
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [branch, setBranch] = useState("all");
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set());

  function toggleBrand(key: string) {
    setOpenBrands((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtered = items.filter((it) => {
    if (category !== "all" && it.category !== category) return false;
    if (branch !== "all" && !(it.stockByShop[branch] > 0)) return false;
    if (search.trim()) {
      const haystack = `${it.productName} ${it.brand ?? ""} ${it.detail} ${it.category}`;
      if (!matchesSearch(haystack, search)) return false;
    }
    return true;
  });
  const brandGroups = groupByBrand(filtered);

  return (
    <main className="animate-fade-in-up mx-auto max-w-3xl px-4 py-8">
      <h1 className="heading text-2xl">Inventory</h1>
      <p className="mt-1 text-sm text-muted">See what&apos;s in stock at each branch.</p>

      <div className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setBranch("all")}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
            branch === "all" ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"
          }`}
        >
          All branches
        </button>
        {branches.map((b) => (
          <button
            key={b.shopId}
            type="button"
            onClick={() => setBranch(b.shopId)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
              branch === b.shopId ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"
            }`}
          >
            {b.shopName}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-3 w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <div className="scrollbar-thin mt-2 flex gap-2 overflow-x-auto pb-1">
        {["all", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors ${
              category === c ? "bg-primary text-on-primary" : "bg-canvas-strong text-body hover:text-ink"
            }`}
          >
            {c === "all" ? "All" : categoryLabel(c)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {brandGroups.map((g) => {
          const brandTotal = g.items.reduce((sum, it) => {
            return (
              sum +
              (branch === "all"
                ? Object.values(it.stockByShop).reduce((a, b) => a + b, 0)
                : (it.stockByShop[branch] ?? 0))
            );
          }, 0);
          const open = openBrands.has(g.brandKey);
          return (
            <div key={g.brandKey} className="rounded-xl border border-hairline bg-canvas-soft">
              <button
                type="button"
                onClick={() => toggleBrand(g.brandKey)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                aria-expanded={open}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{g.brandLabel}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {g.items.length} item{g.items.length === 1 ? "" : "s"} · {brandTotal} in stock
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open && (
                <div className="flex flex-col divide-y divide-hairline border-t border-hairline">
                  {g.items.map((it) => (
                    <div
                      key={it.key}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 text-ink">
                        {it.productName}
                        {it.detail !== "Default" ? ` — ${it.detail}` : ""}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {branch === "all"
                          ? branches.map((b) => {
                              const qty = it.stockByShop[b.shopId] ?? 0;
                              const isLow = it.lowByShop[b.shopId] ?? false;
                              return (
                                <span
                                  key={b.shopId}
                                  title={b.shopName}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isLow ? "bg-error/15 text-error" : "bg-canvas-strong text-body"
                                  }`}
                                >
                                  {b.shopName.split(" ")[0]} {qty}
                                </span>
                              );
                            })
                          : (() => {
                              const qty = it.stockByShop[branch] ?? 0;
                              const isLow = it.lowByShop[branch] ?? false;
                              return (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isLow ? "bg-error/15 text-error" : "bg-canvas-strong text-body"
                                  }`}
                                >
                                  {qty} in stock
                                </span>
                              );
                            })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-muted">No products yet across your branches.</p>
        )}
        {items.length > 0 && brandGroups.length === 0 && (
          <p className="text-sm text-muted">No items match.</p>
        )}
      </div>
    </main>
  );
}
