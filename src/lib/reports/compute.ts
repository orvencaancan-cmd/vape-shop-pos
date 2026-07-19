export type SaleItemRow = {
  sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  variants: {
    flavor: string | null;
    nicotine_mg: number | null;
    size: string | null;
    for_device: string | null;
    ohms: number | null;
    product_id: string;
    products: { name: string; category: "ejuice" | "accessory" } | null;
  } | null;
};

export type VariantRow = {
  id: string;
  flavor: string | null;
  nicotine_mg: number | null;
  size: string | null;
  for_device: string | null;
  ohms: number | null;
  stock_qty: number;
  low_stock_threshold: number;
  cost: number;
  product_id: string;
  products: { name: string; category: "ejuice" | "accessory"; archived: boolean } | null;
};

export type ReceiptRow = {
  supplier_id: string | null;
  quantity_added: number;
  unit_cost: number | null;
  suppliers: { name: string } | null;
};

function variantLabel(v: {
  flavor: string | null;
  nicotine_mg: number | null;
  size: string | null;
  for_device?: string | null;
  ohms?: number | null;
}) {
  return (
    [
      v.flavor,
      v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null,
      v.size,
      v.for_device ? `For ${v.for_device}` : null,
      v.ohms != null ? `${v.ohms}Ω` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Default"
  );
}

export function computeSalesSummary(sales: { total: number }[]) {
  return {
    count: sales.length,
    revenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
  };
}

export function computeRevenueProfit(items: SaleItemRow[]) {
  let revenue = 0;
  let cost = 0;
  for (const item of items) {
    revenue += Number(item.unit_price) * item.quantity;
    cost += Number(item.unit_cost) * item.quantity;
  }
  return { revenue, cost, profit: revenue - cost };
}

export function computeBestSellers(items: SaleItemRow[], limit = 10) {
  const byVariant = new Map<
    string,
    { label: string; productName: string; quantity: number; revenue: number }
  >();
  for (const item of items) {
    const productName = item.variants?.products?.name ?? "Unknown product";
    const label = item.variants ? variantLabel(item.variants) : "Unknown";
    const existing = byVariant.get(item.variant_id) ?? {
      label,
      productName,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.unit_price) * item.quantity;
    byVariant.set(item.variant_id, existing);
  }
  return [...byVariant.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

export function computeSalesByCategory(items: SaleItemRow[]) {
  const byCategory = new Map<string, number>();
  const byNicotine = new Map<string, number>();
  for (const item of items) {
    const category = item.variants?.products?.category ?? "unknown";
    byCategory.set(category, (byCategory.get(category) ?? 0) + Number(item.unit_price) * item.quantity);
    if (category === "ejuice") {
      const mgKey =
        item.variants?.nicotine_mg != null ? `${item.variants.nicotine_mg}mg` : "unspecified";
      byNicotine.set(mgKey, (byNicotine.get(mgKey) ?? 0) + Number(item.unit_price) * item.quantity);
    }
  }
  return {
    byCategory: [...byCategory.entries()].map(([category, revenue]) => ({ category, revenue })),
    byNicotine: [...byNicotine.entries()]
      .map(([mg, revenue]) => ({ mg, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export function computeLowStock(variants: VariantRow[]) {
  return variants
    .filter((v) => !v.products?.archived && v.stock_qty <= v.low_stock_threshold)
    .map((v) => ({
      id: v.id,
      productName: v.products?.name ?? "Unknown product",
      label: variantLabel(v),
      stockQty: v.stock_qty,
      threshold: v.low_stock_threshold,
    }))
    .sort((a, b) => a.stockQty - a.threshold - (b.stockQty - b.threshold));
}

export function computeSlowMovers(
  variants: VariantRow[],
  items: SaleItemRow[],
  limit = 10,
) {
  const soldByVariant = new Map<string, number>();
  for (const item of items) {
    soldByVariant.set(item.variant_id, (soldByVariant.get(item.variant_id) ?? 0) + item.quantity);
  }
  return variants
    .filter((v) => !v.products?.archived && v.stock_qty > 0)
    .map((v) => ({
      id: v.id,
      productName: v.products?.name ?? "Unknown product",
      label: variantLabel(v),
      stockQty: v.stock_qty,
      quantitySold: soldByVariant.get(v.id) ?? 0,
    }))
    .sort((a, b) => a.quantitySold - b.quantitySold)
    .slice(0, limit);
}

export function computeInventoryValue(variants: VariantRow[]) {
  let total = 0;
  const byCategory = new Map<string, number>();
  for (const v of variants) {
    if (v.products?.archived) continue;
    const value = v.stock_qty * Number(v.cost);
    total += value;
    const category = v.products?.category ?? "unknown";
    byCategory.set(category, (byCategory.get(category) ?? 0) + value);
  }
  return { total, byCategory: [...byCategory.entries()].map(([category, value]) => ({ category, value })) };
}

export function computeSupplierActivity(receipts: ReceiptRow[]) {
  const bySupplier = new Map<string, { name: string; quantity: number; cost: number }>();
  for (const r of receipts) {
    const key = r.supplier_id ?? "none";
    const name = r.suppliers?.name ?? "No supplier logged";
    const existing = bySupplier.get(key) ?? { name, quantity: 0, cost: 0 };
    existing.quantity += r.quantity_added;
    existing.cost += (r.unit_cost ?? 0) * r.quantity_added;
    bySupplier.set(key, existing);
  }
  return [...bySupplier.values()].sort((a, b) => b.quantity - a.quantity);
}
