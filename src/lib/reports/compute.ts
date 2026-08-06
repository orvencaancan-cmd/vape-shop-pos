import { variantLabel } from "@/lib/variant-label";

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
    products: { name: string; brand: string | null; category: "ejuice" | "accessory" } | null;
  } | null;
};

export type SaleRow = {
  id: string;
  created_at: string;
  payment_method: string;
  total: number;
  discount_amount: number;
  discount_reason: string | null;
  sale_discount_amount: number;
  loyalty_credit_redeemed: number;
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
  price: number;
  product_id: string;
  products: { name: string; category: "ejuice" | "accessory"; archived: boolean } | null;
};

export type ReceiptRow = {
  supplier_id: string | null;
  quantity_added: number;
  unit_cost: number | null;
  suppliers: { name: string } | null;
};

export function computeSalesSummary(sales: { total: number }[]) {
  return {
    count: sales.length,
    revenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
  };
}

export function computePaymentBreakdown(sales: { total: number; payment_method: string }[]) {
  let cash = 0;
  let gcash = 0;
  for (const s of sales) {
    if (s.payment_method === "gcash") gcash += Number(s.total);
    else cash += Number(s.total);
  }
  return { cash, gcash, total: cash + gcash };
}

export function computeDiscounts(sales: { discount_amount: number }[]) {
  return { total: sales.reduce((sum, s) => sum + Number(s.discount_amount), 0) };
}

export function computeSaleDiscounts(sales: { sale_discount_amount: number }[]) {
  return { total: sales.reduce((sum, s) => sum + Number(s.sale_discount_amount), 0) };
}

export function computeLoyaltySummary(
  sales: {
    loyalty_credit_earned: number;
    loyalty_credit_redeemed: number;
    loyalty_credit_forfeited: number;
  }[],
) {
  let earned = 0;
  let redeemed = 0;
  let forfeited = 0;
  for (const s of sales) {
    earned += Number(s.loyalty_credit_earned);
    redeemed += Number(s.loyalty_credit_redeemed);
    forfeited += Number(s.loyalty_credit_forfeited);
  }
  return { earned, redeemed, forfeited };
}

export function computeExpenseSummary(expenses: { amount: number }[]) {
  return {
    total: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    count: expenses.length,
  };
}

export type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  note: string | null;
  createdAt: string;
};

export type SaleDetail = {
  saleId: string;
  createdAt: string;
  paymentMethod: string;
  total: number;
  discountAmount: number;
  saleDiscountAmount: number;
  loyaltyCreditRedeemed: number;
  note: string;
  lines: {
    brand: string | null;
    productName: string;
    label: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

// Sale, manual Discount, and Loyalty redemption are mutually exclusive per
// record_sale (supabase/migrations/0031_sale_promo.sql), so at most one of
// these three branches ever fires for a given sale.
function buildSaleNote(
  discountAmount: number,
  discountReason: string | null,
  saleDiscountAmount: number,
  loyaltyCreditRedeemed: number,
): string {
  const parts: string[] = [];
  if (saleDiscountAmount > 0) {
    parts.push("Discount promo");
  }
  if (discountAmount > 0) {
    parts.push(discountReason ? `Discount: ${discountReason}` : "Discount");
  }
  if (loyaltyCreditRedeemed > 0) {
    parts.push("Used loyalty credit");
  }
  return parts.join(" · ");
}

export function computeSalesDetail(sales: SaleRow[], items: SaleItemRow[]): SaleDetail[] {
  const linesBySale = new Map<string, SaleDetail["lines"]>();
  for (const item of items) {
    const product = item.variants?.products;
    const line = {
      brand: product?.brand ?? null,
      productName: product?.name ?? "Unknown product",
      label: item.variants ? variantLabel(item.variants) : "Unknown",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.unit_price) * item.quantity,
    };
    if (!linesBySale.has(item.sale_id)) linesBySale.set(item.sale_id, []);
    linesBySale.get(item.sale_id)!.push(line);
  }
  return sales
    .map((s) => ({
      saleId: s.id,
      createdAt: s.created_at,
      paymentMethod: s.payment_method,
      total: Number(s.total),
      discountAmount: Number(s.discount_amount),
      saleDiscountAmount: Number(s.sale_discount_amount),
      loyaltyCreditRedeemed: Number(s.loyalty_credit_redeemed),
      note: buildSaleNote(
        Number(s.discount_amount),
        s.discount_reason,
        Number(s.sale_discount_amount),
        Number(s.loyalty_credit_redeemed),
      ),
      lines: linesBySale.get(s.id) ?? [],
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
      productId: v.product_id,
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

// "If every unit currently in stock sold at its listed price" -- a snapshot
// projection from current inventory, not a sales-velocity forecast. Distinct
// from computeRevenueProfit (which sums actual completed sales in the
// selected date range).
export function computeProjectedRevenueProfit(variants: VariantRow[]) {
  let revenue = 0;
  let cost = 0;
  for (const v of variants) {
    if (v.products?.archived) continue;
    revenue += v.stock_qty * Number(v.price);
    cost += v.stock_qty * Number(v.cost);
  }
  return { revenue, cost, profit: revenue - cost };
}

export function computeDailySeries(sales: { total: number; created_at: string }[], days: number) {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of sales) {
    const key = s.created_at.slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(s.total));
    }
  }
  return [...buckets.entries()].map(([date, revenue]) => ({ date, revenue }));
}

export type StaffSaleRow = { total: number; created_by: string | null; voided_at: string | null };

export function computeStaffActivity(
  sales: StaffSaleRow[],
  profiles: { id: string; display_name: string | null }[],
) {
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  const byStaff = new Map<
    string,
    { name: string; count: number; revenue: number; voidedCount: number }
  >();
  for (const s of sales) {
    const key = s.created_by ?? "unknown";
    const existing = byStaff.get(key) ?? {
      name: nameById.get(key) || "Unnamed staff",
      count: 0,
      revenue: 0,
      voidedCount: 0,
    };
    if (s.voided_at) {
      existing.voidedCount += 1;
    } else {
      existing.count += 1;
      existing.revenue += Number(s.total);
    }
    byStaff.set(key, existing);
  }
  return [...byStaff.values()]
    .map((s) => ({
      ...s,
      averageSale: s.count > 0 ? s.revenue / s.count : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type CashSessionRow = {
  id: string;
  businessDate: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  status: "open" | "closed";
  shopName?: string;
};

export type CashMovementRow = {
  id: string;
  createdAt: string;
  direction: "in" | "out";
  movementType: "general" | "branch_transfer" | "floating_pool";
  amount: number;
  note: string | null;
  createdByName: string | null;
  counterpartyName: string | null;
  shopName?: string;
};

export function computeCashMovementsSummary(movements: { direction: "in" | "out"; amount: number }[]) {
  let cashIn = 0;
  let cashOut = 0;
  for (const m of movements) {
    if (m.direction === "in") cashIn += Number(m.amount);
    else cashOut += Number(m.amount);
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
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
