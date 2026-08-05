export type BrandGroup<T> = { brandKey: string; brandLabel: string; items: T[] };

const NO_BRAND = "__no_brand__";

/**
 * Groups items by `brand`, sorted alphabetically with unbranded items last
 * -- the grouping/sort shared by the Sell screen's catalog, the audit
 * screen's count list, and the Sale settings item picker (previously
 * near-identical copies in each).
 */
export function groupByBrand<T extends { brand: string | null }>(items: T[]): BrandGroup<T>[] {
  const map = new Map<string, BrandGroup<T>>();
  for (const item of items) {
    const brandKey = item.brand ?? NO_BRAND;
    if (!map.has(brandKey)) {
      map.set(brandKey, { brandKey, brandLabel: item.brand ?? "No brand", items: [] });
    }
    map.get(brandKey)!.items.push(item);
  }
  return [...map.values()].sort((a, b) => {
    if (a.brandKey === NO_BRAND) return 1;
    if (b.brandKey === NO_BRAND) return -1;
    return a.brandLabel.localeCompare(b.brandLabel);
  });
}
