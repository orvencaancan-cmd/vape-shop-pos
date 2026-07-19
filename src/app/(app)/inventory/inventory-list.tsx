"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ReceiveStockForm } from "./receive-stock-form";

export type InventoryVariant = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  latestSupplier: string | null;
};

const ALL = "__all__";

export function InventoryList({
  variants,
  suppliers,
  canEdit,
}: {
  variants: InventoryVariant[];
  suppliers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [brand, setBrand] = useState(ALL);
  const [flavor, setFlavor] = useState(ALL);
  const [nicotine, setNicotine] = useState(ALL);

  const brands = useMemo(
    () => [...new Set(variants.map((v) => v.brand).filter(Boolean))].sort() as string[],
    [variants],
  );
  const flavors = useMemo(
    () => [...new Set(variants.map((v) => v.flavor).filter(Boolean))].sort() as string[],
    [variants],
  );
  const nicotineLevels = useMemo(
    () =>
      [...new Set(variants.map((v) => v.nicotineMg).filter((n) => n != null))].sort(
        (a, b) => (a as number) - (b as number),
      ) as number[],
    [variants],
  );

  const filtered = variants.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (brand !== ALL && v.brand !== brand) return false;
    if (flavor !== ALL && v.flavor !== flavor) return false;
    if (nicotine !== ALL && String(v.nicotineMg) !== nicotine) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${v.productName} ${v.brand ?? ""} ${v.flavor ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const productsInOrder = [...new Map(filtered.map((v) => [v.productId, v.productName])).entries()];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, brand, flavor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {(["all", "ejuice", "accessory"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-md px-3 py-2 text-sm ${
              category === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {c === "all" ? "All" : c === "ejuice" ? "E-juice" : "Accessories"}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value={ALL}>All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={flavor}
          onChange={(e) => setFlavor(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value={ALL}>All flavors</option>
          {flavors.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={nicotine}
          onChange={(e) => setNicotine(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value={ALL}>All nicotine levels</option>
          {nicotineLevels.map((n) => (
            <option key={n} value={String(n)}>
              {n}mg
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {productsInOrder.map(([productId, productName]) => {
          const productVariants = filtered.filter((v) => v.productId === productId);
          const productCategory = productVariants[0]?.category;
          return (
            <section key={productId}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-lg font-medium text-slate-900">
                  {productName}{" "}
                  <span className="text-xs font-normal uppercase text-slate-400">
                    {productCategory}
                  </span>
                </h2>
                {canEdit && (
                  <Link
                    href={`/inventory/${productId}`}
                    className="text-sm text-slate-500 underline"
                  >
                    Edit
                  </Link>
                )}
              </div>

              <div className="mt-2 flex flex-col divide-y divide-slate-100">
                {productVariants.map((v) => {
                  const isLow = v.stockQty <= v.lowStockThreshold;
                  const label =
                    [v.flavor, v.nicotineMg != null ? `${v.nicotineMg}mg` : null, v.size]
                      .filter(Boolean)
                      .join(" · ") || "Default";
                  return (
                    <div
                      key={v.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                        <span className="text-sm text-slate-800">{label}</span>
                        {v.brand && (
                          <span className="text-xs text-slate-400">{v.brand}</span>
                        )}
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            isLow ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {v.stockQty} in stock
                        </span>
                        <span className="text-xs text-slate-400">
                          ${v.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {v.latestSupplier ?? "no supplier logged"}
                        </span>
                      </div>
                      <ReceiveStockForm variantId={v.id} suppliers={suppliers} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {productsInOrder.length === 0 && (
          <p className="text-sm text-slate-400">No products match.</p>
        )}
      </div>
    </div>
  );
}
