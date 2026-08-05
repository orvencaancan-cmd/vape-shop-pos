"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ReceiveStockForm } from "./receive-stock-form";
import { CorrectStockForm } from "./correct-stock-form";
import {
  archiveProductAction,
  updateBrandSupplierAction,
  updateBrandCostAction,
  updateAccessoryCostAction,
  addBrandFlavorsAction,
  getBrandRestockHistoryAction,
  getProductRestockHistoryAction,
  type RestockHistoryRow,
} from "./actions";
import { formatCurrency } from "@/lib/currency";
import { variantLabel } from "@/lib/variant-label";
import { ActionButton } from "@/components/action-button";
import { matchesSearch } from "@/lib/search-match";

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
  cost: number;
  stockQty: number;
  lowStockThreshold: number;
  supplierName: string | null;
  lastRestockedAt: string | null;
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

// Groups a product's variants by flavor so the flavor is shown once above its
// nicotine-level rows, instead of repeating the same flavor text on every row.
function groupByFlavor(variants: InventoryVariant[]): [string, InventoryVariant[]][] {
  const groups = new Map<string, InventoryVariant[]>();
  for (const v of variants) {
    const key = v.flavor ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  return [...groups.entries()];
}

// Shown once under the brand heading, inconspicuously -- only when every
// product in the brand agrees on the same supplier, to avoid stating a
// single supplier for a brand that's actually sourced from more than one.
function getBrandSupplier(products: ProductGroup[]): string | null {
  const names = new Set(
    products.flatMap((p) => p.variants.map((v) => v.supplierName)).filter((n): n is string => !!n),
  );
  return names.size === 1 ? [...names][0] : null;
}

// Every distinct nicotine level found among a brand's e-juice variants, so
// Unit cost can be edited per level (cost commonly differs by strength even
// though every flavor at one strength shares a cost). Scoped to e-juice
// products only -- accessories have no nicotine dimension and are scoped by
// subcategory instead, below.
function getBrandNicotineLevels(products: ProductGroup[]): number[] {
  const levels = new Set(
    products
      .filter((p) => p.category === "ejuice")
      .flatMap((p) => p.variants.map((v) => v.nicotineMg))
      .filter((mg): mg is number => mg != null),
  );
  return [...levels].sort((a, b) => a - b);
}

// Same idea as getBrandSupplier, for one nicotine level's Unit cost field --
// pre-fills only when every e-juice variant at that level already shares one cost.
function getBrandCostForLevel(products: ProductGroup[], nicotineMg: number): number | null {
  const costs = new Set(
    products
      .filter((p) => p.category === "ejuice")
      .flatMap((p) => p.variants.filter((v) => v.nicotineMg === nicotineMg).map((v) => v.cost)),
  );
  return costs.size === 1 ? [...costs][0] : null;
}

// Every distinct accessory subcategory found among a brand's products (e.g.
// a brand like OXVA can sell both a Device and a Cartridge line). Unit cost
// is scoped per subcategory rather than flat per brand, since different
// accessory types under one brand don't share a cost just because they
// share a brand name.
function getAccessorySubcategories(products: ProductGroup[]): (string | null)[] {
  const subs = new Set(products.filter((p) => p.category === "accessory").map((p) => p.subcategory));
  return [...subs].sort((a, b) => (a ?? "").localeCompare(b ?? ""));
}

// Same idea as getBrandCostForLevel, scoped to one accessory subcategory.
function getAccessoryCostForSubcategory(products: ProductGroup[], subcategory: string | null): number | null {
  const costs = new Set(
    products
      .filter((p) => p.category === "accessory" && p.subcategory === subcategory)
      .flatMap((p) => p.variants.map((v) => v.cost)),
  );
  return costs.size === 1 ? [...costs][0] : null;
}

function latestDate(dates: string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((latest, d) => (d > latest ? d : latest));
}

// Most recent restock date across every e-juice variant under a brand,
// shown as one flat line -- e-juice flavors under a brand are typically
// restocked together in one batch, so a per-brand summary is meaningful
// (unlike accessories, which restock independently per product -- see
// getProductLastRestocked below).
function getBrandLastRestocked(products: ProductGroup[]): string | null {
  return latestDate(
    products
      .filter((p) => p.category === "ejuice")
      .flatMap((p) => p.variants.map((v) => v.lastRestockedAt))
      .filter((d): d is string => d != null),
  );
}

// Most recent restock date across one accessory product's own variants
// (e.g. every color of a Device). Shown per product rather than flat per
// brand, since different named products under one brand -- a Device vs a
// Cartridge -- restock on their own schedules.
function getProductLastRestocked(variants: InventoryVariant[]): string | null {
  return latestDate(variants.map((v) => v.lastRestockedAt).filter((d): d is string => d != null));
}

// Shared by the brand-level and product-level "View restock history"
// expansions -- same row shape (RestockHistoryRow) either way.
function RestockHistoryList({ rows }: { rows: "loading" | RestockHistoryRow[] }) {
  if (rows === "loading") {
    return <p className="mt-1 text-xs text-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="mt-1 text-xs text-muted">No restocks logged yet.</p>;
  }
  return (
    <div className="mt-1 flex flex-col divide-y divide-hairline">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-1 text-xs">
          <span className="text-muted">{new Date(r.date).toLocaleDateString()}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
          <span className="text-ink">+{r.quantity}</span>
          <span className="text-muted">{r.receivedByName ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function InventoryList({
  variants,
  supplierNames,
  canEdit,
}: {
  variants: InventoryVariant[];
  supplierNames: string[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);
  const [category, setCategory] = useState<"all" | "ejuice" | "accessory">("all");
  const [brand, setBrand] = useState(ALL);
  const [flavor, setFlavor] = useState(ALL);
  const [nicotine, setNicotine] = useState(ALL);
  const [device, setDevice] = useState(ALL);
  const [ohms, setOhms] = useState(ALL);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [addFlavorBrands, setAddFlavorBrands] = useState<Set<string>>(new Set());
  // Keyed error display for the brand-level Supplier/Cost/Add-flavor forms
  // below -- those actions used to return void and fail silently (only a
  // server console.error). Each form's onSubmit calls its bound action
  // directly instead of relying on <form action> alone, so a returned
  // {error} can be shown inline right under that specific form.
  const [formErrors, setFormErrors] = useState<Map<string, string>>(new Map());
  function handleFormSubmit(key: string, action: (formData: FormData) => Promise<{ error?: string }>) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      const result = await action(new FormData(e.currentTarget));
      if (result.error) {
        setFormErrors((prev) => new Map(prev).set(key, result.error!));
      }
    };
  }
  const [brandRestockHistory, setBrandRestockHistory] = useState<Map<string, "loading" | RestockHistoryRow[]>>(
    new Map(),
  );
  const [productRestockHistory, setProductRestockHistory] = useState<
    Map<string, "loading" | RestockHistoryRow[]>
  >(new Map());

  const hasActiveFilter =
    search.trim() !== "" ||
    category !== "all" ||
    brand !== ALL ||
    flavor !== ALL ||
    nicotine !== ALL ||
    device !== ALL ||
    ohms !== ALL;

  const toggleBrand = (brandKey: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandKey)) {
        next.delete(brandKey);
      } else {
        next.add(brandKey);
      }
      return next;
    });
  };

  const toggleAddFlavor = (brandKey: string) => {
    setAddFlavorBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandKey)) {
        next.delete(brandKey);
      } else {
        next.add(brandKey);
      }
      return next;
    });
  };

  const toggleBrandRestockHistory = async (brandKey: string, brand: string | null) => {
    if (brandRestockHistory.has(brandKey)) {
      setBrandRestockHistory((prev) => {
        const next = new Map(prev);
        next.delete(brandKey);
        return next;
      });
      return;
    }
    setBrandRestockHistory((prev) => new Map(prev).set(brandKey, "loading"));
    const rows = await getBrandRestockHistoryAction(brand);
    setBrandRestockHistory((prev) => new Map(prev).set(brandKey, rows));
  };

  const toggleProductRestockHistory = async (productId: string) => {
    if (productRestockHistory.has(productId)) {
      setProductRestockHistory((prev) => {
        const next = new Map(prev);
        next.delete(productId);
        return next;
      });
      return;
    }
    setProductRestockHistory((prev) => new Map(prev).set(productId, "loading"));
    const rows = await getProductRestockHistoryAction(productId);
    setProductRestockHistory((prev) => new Map(prev).set(productId, rows));
  };

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
      const haystack = `${v.productName} ${v.brand ?? ""} ${v.flavor ?? ""} ${v.subcategory ?? ""} ${v.forDevice ?? ""} ${v.supplierName ?? ""}`;
      if (!matchesSearch(haystack, search)) return false;
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
    for (const p of g.products) {
      p.variants.sort((a, b) => (a.nicotineMg ?? Infinity) - (b.nicotineMg ?? Infinity));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search name, brand, flavor, device, supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 pr-8 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
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
        {brandGroups.map((brandGroup) => {
          const isExpanded = hasActiveFilter || expandedBrands.has(brandGroup.brandKey);
          return (
          <section
            key={brandGroup.brandKey}
            className="rounded-xl border border-hairline bg-canvas-soft px-5 py-4"
          >
            <button
              type="button"
              onClick={() => toggleBrand(brandGroup.brandKey)}
              className="flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={isExpanded}
            >
              <h2 className="heading text-lg">{brandGroup.brandLabel}</h2>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isExpanded && (
            <div className="animate-fade-in-up mt-4 flex flex-col gap-5">
              {canEdit && (
                <div className="-mt-3 flex flex-col gap-2">
                  <form
                    onSubmit={handleFormSubmit(
                      `supplier-${brandGroup.brandKey}`,
                      updateBrandSupplierAction.bind(
                        null,
                        brandGroup.brandKey === NO_BRAND ? null : brandGroup.brandLabel,
                      ),
                    )}
                    className="flex items-center gap-2"
                  >
                    <label className="text-xs text-muted">Supplier</label>
                    <input
                      name="supplier"
                      defaultValue={getBrandSupplier(brandGroup.products) ?? ""}
                      list={`brand-supplier-suggestions-${brandGroup.brandKey}`}
                      placeholder="e.g. Metro Vape Distributors"
                      className="rounded border border-hairline bg-canvas px-2 py-0.5 text-xs text-ink placeholder:text-muted"
                    />
                    <datalist id={`brand-supplier-suggestions-${brandGroup.brandKey}`}>
                      {supplierNames.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <button type="submit" className="text-xs text-primary underline underline-offset-2">
                      Save
                    </button>
                  </form>
                  {formErrors.get(`supplier-${brandGroup.brandKey}`) && (
                    <p className="text-xs text-error">{formErrors.get(`supplier-${brandGroup.brandKey}`)}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    {getBrandNicotineLevels(brandGroup.products).map((mg) => {
                      const errorKey = `cost-${brandGroup.brandKey}-${mg}`;
                      return (
                        <div key={`ejuice-${mg}`} className="flex flex-col gap-1">
                          <form
                            onSubmit={handleFormSubmit(
                              errorKey,
                              updateBrandCostAction.bind(
                                null,
                                brandGroup.brandKey === NO_BRAND ? null : brandGroup.brandLabel,
                                mg,
                              ),
                            )}
                            className="flex items-center gap-2"
                          >
                            <label className="text-xs text-muted">{mg}mg cost</label>
                            <input
                              name="cost"
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={getBrandCostForLevel(brandGroup.products, mg) ?? ""}
                              placeholder="Applies to every flavor"
                              className="w-36 rounded border border-hairline bg-canvas px-2 py-0.5 text-xs text-ink placeholder:text-muted"
                            />
                            <button type="submit" className="text-xs text-primary underline underline-offset-2">
                              Save
                            </button>
                          </form>
                          {formErrors.get(errorKey) && (
                            <p className="text-xs text-error">{formErrors.get(errorKey)}</p>
                          )}
                        </div>
                      );
                    })}
                    {getAccessorySubcategories(brandGroup.products).map((sub) => {
                      const errorKey = `accessory-cost-${brandGroup.brandKey}-${sub ?? "none"}`;
                      return (
                        <div key={`accessory-${sub ?? "none"}`} className="flex flex-col gap-1">
                          <form
                            onSubmit={handleFormSubmit(
                              errorKey,
                              updateAccessoryCostAction.bind(
                                null,
                                brandGroup.brandKey === NO_BRAND ? null : brandGroup.brandLabel,
                                sub,
                              ),
                            )}
                            className="flex items-center gap-2"
                          >
                            <label className="text-xs text-muted">{sub ? `${sub} cost` : "Unit cost"}</label>
                            <input
                              name="cost"
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={getAccessoryCostForSubcategory(brandGroup.products, sub) ?? ""}
                              placeholder={sub ? `Applies to every ${sub.toLowerCase()}` : "Applies to every item"}
                              className="w-36 rounded border border-hairline bg-canvas px-2 py-0.5 text-xs text-ink placeholder:text-muted"
                            />
                            <button type="submit" className="text-xs text-primary underline underline-offset-2">
                              Save
                            </button>
                          </form>
                          {formErrors.get(errorKey) && (
                            <p className="text-xs text-error">{formErrors.get(errorKey)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {getBrandNicotineLevels(brandGroup.products).length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleAddFlavor(brandGroup.brandKey)}
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    + Add flavor
                  </button>
                  {addFlavorBrands.has(brandGroup.brandKey) && (
                    <form
                      onSubmit={handleFormSubmit(
                        `add-flavors-${brandGroup.brandKey}`,
                        addBrandFlavorsAction.bind(
                          null,
                          brandGroup.brandKey === NO_BRAND ? null : brandGroup.brandLabel,
                        ),
                      )}
                      className="mt-2 flex flex-col gap-2"
                    >
                      <textarea
                        name="flavors"
                        rows={2}
                        placeholder="One flavor per line — nicotine levels, size, cost, and price are copied from this brand"
                        className="w-full max-w-sm rounded border border-hairline bg-canvas px-2 py-1 text-xs text-ink placeholder:text-muted"
                      />
                      <button
                        type="submit"
                        className="self-start rounded bg-primary px-2 py-1 text-xs text-on-primary hover:bg-primary-active"
                      >
                        Add
                      </button>
                      {formErrors.get(`add-flavors-${brandGroup.brandKey}`) && (
                        <p className="text-xs text-error">
                          {formErrors.get(`add-flavors-${brandGroup.brandKey}`)}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}
              {(() => {
                const lastRestocked = getBrandLastRestocked(brandGroup.products);
                if (!lastRestocked) return null;
                const historyKey = brandGroup.brandKey;
                const brandArg = brandGroup.brandKey === NO_BRAND ? null : brandGroup.brandLabel;
                return (
                  <div>
                    <p className="text-xs text-muted">
                      Last restocked {new Date(lastRestocked).toLocaleDateString()}{" "}
                      <button
                        type="button"
                        onClick={() => toggleBrandRestockHistory(historyKey, brandArg)}
                        className="text-primary underline underline-offset-2"
                      >
                        {brandRestockHistory.has(historyKey) ? "Hide" : "View"} restock history
                      </button>
                    </p>
                    {brandRestockHistory.has(historyKey) && (
                      <RestockHistoryList rows={brandRestockHistory.get(historyKey)!} />
                    )}
                  </div>
                );
              })()}
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
                      {product.category === "accessory" &&
                        (() => {
                          const lastRestocked = getProductLastRestocked(product.variants);
                          return lastRestocked ? (
                            <span className="text-xs font-normal text-muted">
                              {" "}
                              · Last restocked {new Date(lastRestocked).toLocaleDateString()}{" "}
                              <button
                                type="button"
                                onClick={() => toggleProductRestockHistory(product.productId)}
                                className="text-primary underline underline-offset-2"
                              >
                                {productRestockHistory.has(product.productId) ? "Hide" : "View"} restock history
                              </button>
                            </span>
                          ) : null;
                        })()}
                    </h3>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-3">
                        <Link
                          href={`/inventory/${product.productId}`}
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          Edit
                        </Link>
                        <ActionButton
                          action={archiveProductAction.bind(null, product.productId)}
                          confirmMessage={`Delete ${product.productName}? This hides it from your inventory but keeps its sales history.`}
                          className="text-sm text-error underline underline-offset-2"
                        >
                          Delete
                        </ActionButton>
                      </div>
                    )}
                  </div>
                  {productRestockHistory.has(product.productId) && (
                    <RestockHistoryList rows={productRestockHistory.get(product.productId)!} />
                  )}

                  <div className="mt-2 flex flex-col gap-3">
                    {groupByFlavor(product.variants).map(([flavorKey, vs]) => (
                      <div key={flavorKey || "__none__"}>
                        {flavorKey && flavorKey !== product.productName && (
                          <p className="text-xs font-medium uppercase text-muted">{flavorKey}</p>
                        )}
                        <div className="mt-1 flex flex-col divide-y divide-hairline">
                          {vs.map((v) => {
                            const isLow = v.stockQty <= v.lowStockThreshold;
                            const detail = variantLabel({
                              nicotine_mg: v.nicotineMg,
                              size: v.size,
                              for_device: v.forDevice,
                              ohms: v.ohms,
                            });
                            return (
                              <div
                                key={v.id}
                                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                                  <span className="text-sm text-ink">{detail}</span>
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
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <ReceiveStockForm variantId={v.id} canManageCost={canEdit} />
                                  {canEdit && (
                                    <CorrectStockForm variantId={v.id} currentQty={v.stockQty} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}
          </section>
          );
        })}

        {brandGroups.length === 0 && (
          <p className="text-sm text-muted">No products match.</p>
        )}
      </div>
    </div>
  );
}
