import type { SaleItemRow, VariantRow, ReceiptRow } from "./compute";

export function normalizeSaleItems(rows: unknown[]): SaleItemRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    sale_id: r.sale_id as string,
    variant_id: r.variant_id as string,
    quantity: r.quantity as number,
    unit_price: r.unit_price as number,
    unit_cost: r.unit_cost as number,
    variants: normalizeOne(r.variants) as SaleItemRow["variants"],
  }));
}

export function normalizeVariants(rows: unknown[]): VariantRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    flavor: r.flavor as string | null,
    nicotine_mg: r.nicotine_mg as number | null,
    size: r.size as string | null,
    for_device: r.for_device as string | null,
    ohms: r.ohms != null ? Number(r.ohms) : null,
    stock_qty: r.stock_qty as number,
    low_stock_threshold: r.low_stock_threshold as number,
    cost: r.cost as number,
    product_id: r.product_id as string,
    products: normalizeOne(r.products) as VariantRow["products"],
  }));
}

export function normalizeReceipts(rows: unknown[]): ReceiptRow[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    supplier_id: r.supplier_id as string | null,
    quantity_added: r.quantity_added as number,
    unit_cost: r.unit_cost as number | null,
    suppliers: normalizeOne(r.suppliers) as ReceiptRow["suppliers"],
  }));
}

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
