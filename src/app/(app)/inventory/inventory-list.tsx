"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ReceiveStockForm } from "./receive-stock-form";
import { archiveProductAction } from "./actions";
import { formatCurrency } from "@/lib/currency";

export type InventoryVariant = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  category: "ejuice" | "accessory";
  subcategory: string | null;
  flavor: string | null;
  nicotineMg: number | null;
  size: string | null;
  forDevice: string | null;
  ohms: number | null;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  latestSupplier: string | null;
};

type ProductGroup = {
  productId: string;
  productName: string;
  category: "ejuice" | "accessory";
  subcategory: string | null;
  variants: InventoryVariant[];
};

type BrandGroup = {
  brandKey: string;
  brandLabel: string;
  products: ProductGroup[];
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
  const [device, setDevice] = useState(ALL);
  const [ohms, setOhms] = useState(ALL);

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
  const devices = useMemo(
    () => [...new Set(variants.map((v) => v.forDevice).filter(Boolean))].sort() as string[],
    [variants],
  );
  const ohmsLevels = useMemo(
    () =>
      [...new Set(variants.map((v) => v.ohms).filter((n) => n != null))].sort(
        (a, b) => (a as number) - (b as number),
      ) as number[],
    [variants],
  );

  const filtered = variants.filter((v) => {
    if (category !== "all" && v.category !== category) return false;
    if (brand !== ALL && v.brand !== brand) return false;
    if (flavor !== ALL && v.flavor !== flavor) return false;
    if (nicotine !== ALL && String(v.nicotineMg) !== nicotine) return false;
    if (device !== ALL && v.forDevice !== device) return false;
    if (ohms !== ALL && String(v.ohms) !== ohms) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${v.productName} ${v.brand ?? ""} ${v.flavor ?? ""} ${v.subcategory ?? ""} ${v.forDevice ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const NO_BRAND = "__no_brand__";
  const brandGroupMap = new Map<string, BrandGroup>();
  const productMapByBrand = new Map<string, Map<string, ProductGroup>>();

  for (const v of filtered) {
    const brandKey = v.brand ?? NO_BRAND;
    if (!brandGroupMap.has(brandKey)) {
      brandGroupMap.set(brandKey, { brandKey, brandLabel: v.brand ?? "No brand", products: [] });
      productMapByBrand.set(brandKey, new Map());
    }
    const productMap = productMapByBrand.get(brandKey)!;
    if (!productMap.has(v.productId)) {
      const group: ProductGroup = {
        productId: v.productId,
        productName: v.productName,
        category: v.category,
        subcategory: v.subcategory,
        variants: [],
      };
      productMap.set(v.productId, group);
      brandGroupMap.get(brandKey)!.products.push(group);
    }
    productMap.get(v.productId)!.variants.push(v);
  }

  const brandGroups = [...brandGroupMap.values()];
  brandGroups.sort((a, b) => {
    if (a.brandKey === NO_BRAND) return 1;
    if (b.brandKey === NO_BRAND) return -1;
    return a.brandLabel.localeCompare(b.brandLabel);
  });
  for (const g of brandGroups) {
    g.products.sort((a, b) => a.productName.localeCompare(b.productName));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, brand, flavor, device…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        />
        {(["all", "ejuice", "accessory"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              category === c
                ? "bg-primary text-on-primary"
                : "bg-canvas-strong text-body hover:text-ink"
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
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
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
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
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
          className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
        >
          <option value={ALL}>All nicotine levels</option>
          {nicotineLevels.map((n) => (
            <option key={n} value={String(n)}>
              {n}mg
            </option>
          ))}
        </select>
        {devices.length > 0 && (
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
          >
            <option value={ALL}>All devices</option>
            {devices.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        {ohmsLevels.length > 0 && (
          <select
            value={ohms}
            onChange={(e) => setOhms(e.target.value)}
            className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
          >
            <option value={ALL}>All ohms</option>
            {ohmsLevels.map((o) => (
              <option key={o} value={String(o)}>
                {o}Ω
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="stagger mt-6 flex flex-col gap-6">
        {brandGroups.map((brandGroup) => (
          <section
            key={brandGroup.brandKey}
            className="rounded-xl border border-hairline bg-canvas-soft px-5 py-4"
          >
            <h2 className="heading text-lg">{brandGroup.brandLabel}</h2>
            <div className="mt-4 flex flex-col gap-5">
              {brandGroup.products.map((product) => (
                <div key={product.productId}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-ink">
                      {product.productName}{" "}
                      <span className="text-xs font-normal uppercase text-muted">
                        {product.subcategory
                          ? `${product.subcategory} · ${product.category}`
                          : product.category}
                      </span>
                    </h3>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-3">
                        <Link
                          href={`/inventory/${product.productId}`}
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          Edit
                        </Link>
                        <form
                          action={archiveProductAction.bind(null, product.productId)}
                          onSubmit={(e) => {
                            if (
                              !confirm(
                                `Delete ${product.productName}? This hides it from your inventory but keeps its sales history.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <button type="submit" className="text-sm text-error underline underline-offset-2">
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-col divide-y divide-hairline">
                    {product.variants.map((v) => {
                      const isLow = v.stockQty <= v.lowStockThreshold;
                      const label =
                        [
                          v.flavor && v.flavor !== v.productName ? v.flavor : null,
                          v.nicotineMg != null ? `${v.nicotineMg}mg` : null,
                          v.size,
                          v.forDevice ? `For ${v.forDevice}` : null,
                          v.ohms != null ? `${v.ohms}Ω` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Default";
                      return (
                        <div
                          key={v.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                            <span className="text-sm text-ink">{label}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isLow ? "bg-error/15 text-error" : "bg-canvas-strong text-body"
                              }`}
                            >
                              {v.stockQty} in stock
                            </span>
                            <span className="text-xs text-muted">
                              {formatCurrency(v.price)}
                            </span>
                            <span className="text-xs text-muted">
                              {v.latestSupplier ?? "no supplier logged"}
                            </span>
                          </div>
                          <ReceiveStockForm variantId={v.id} suppliers={suppliers} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {brandGroups.length === 0 && (
          <p className="text-sm text-muted">No products match.</p>
        )}
      </div>
    </div>
  );
}
