import type { createClient } from "@/lib/supabase/server";
import type { DateRange } from "./date-range";
import {
  computeSalesSummary,
  computeSalesDetail,
  computeRevenueProfit,
  computeBestSellers,
  computeSalesByCategory,
  computeLowStock,
  computeSlowMovers,
  computeInventoryValue,
  computeProjectedRevenueProfit,
  computeSupplierActivity,
  computeStaffActivity,
  computePaymentBreakdown,
  computeDiscounts,
  computeSaleDiscounts,
  computeLoyaltySummary,
  computeExpenseSummary,
  computeCashMovementsSummary,
  type SaleItemRow,
  type ExpenseRow,
  type CashSessionRow,
  type CashMovementRow,
} from "./compute";
import { normalizeSaleItems, normalizeVariants, normalizeReceipts } from "./normalize";

export type SingleShopReportData = {
  salesSummary: ReturnType<typeof computeSalesSummary>;
  paymentBreakdown: ReturnType<typeof computePaymentBreakdown>;
  discounts: ReturnType<typeof computeDiscounts>;
  saleDiscounts: ReturnType<typeof computeSaleDiscounts>;
  loyaltySummary: ReturnType<typeof computeLoyaltySummary>;
  salesDetail: ReturnType<typeof computeSalesDetail>;
  revenueProfit: ReturnType<typeof computeRevenueProfit>;
  bestSellers: ReturnType<typeof computeBestSellers>;
  byCategory: ReturnType<typeof computeSalesByCategory>["byCategory"];
  byNicotine: ReturnType<typeof computeSalesByCategory>["byNicotine"];
  lowStock: ReturnType<typeof computeLowStock>;
  slowMovers: ReturnType<typeof computeSlowMovers>;
  inventoryValue: ReturnType<typeof computeInventoryValue>;
  projectedRevenueProfit: ReturnType<typeof computeProjectedRevenueProfit>;
  supplierActivity: ReturnType<typeof computeSupplierActivity>;
  staffActivity: ReturnType<typeof computeStaffActivity>;
  expenses: ExpenseRow[];
  expenseSummary: ReturnType<typeof computeExpenseSummary>;
  cashSessions: CashSessionRow[];
  cashMovements: CashMovementRow[];
  cashMovementsSummary: ReturnType<typeof computeCashMovementsSummary>;
};

export async function fetchSingleShopReportData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  { from, to }: DateRange,
): Promise<SingleShopReportData> {
  const { data: sales } = await supabase
    .from("sales")
    .select(
      "id, total, payment_method, discount_amount, discount_reason, sale_discount_amount, loyalty_credit_earned, loyalty_credit_redeemed, loyalty_credit_forfeited, created_at",
    )
    .eq("shop_id", shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .is("voided_at", null);

  const saleIds = (sales ?? []).map((s) => s.id);

  const { data: saleItems } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select(
          "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, brand, category))",
        )
        .eq("shop_id", shopId)
        .in("sale_id", saleIds)
    : { data: [] as SaleItemRow[] };

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, price, product_id, products(name, category, archived)",
    )
    .eq("shop_id", shopId);

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select("supplier_id, quantity_added, unit_cost, suppliers(name)")
    .eq("shop_id", shopId)
    .gte("received_at", from.toISOString())
    .lt("received_at", to.toISOString());

  const { data: staffSales } = await supabase
    .from("sales")
    .select("total, created_by, voided_at")
    .eq("shop_id", shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());

  // No shop_id filter: this is purely an id -> display_name lookup for
  // computeStaffActivity below, keyed off the shop-scoped staffSales list.
  // A staff member who was later transferred to another owned branch would
  // otherwise fail this lookup (their profiles.shop_id no longer matches
  // this shop) and show as "Unnamed staff" on their own historical sales.
  // RLS's profiles_select already limits rows to shops this caller belongs
  // to, so no cross-tenant data is exposed by dropping the filter.
  const { data: staffProfiles } = await supabase.from("profiles").select("id, display_name");

  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("id, amount, category, note, created_at")
    .eq("shop_id", shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false });

  const expenses: ExpenseRow[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    note: e.note,
    createdAt: e.created_at,
  }));

  const { data: cashSessionRows } = await supabase
    .from("cash_sessions")
    .select("id, business_date, opening_cash, closing_cash, expected_cash, variance, status")
    .eq("shop_id", shopId)
    .gte("business_date", from.toISOString().slice(0, 10))
    .lt("business_date", to.toISOString().slice(0, 10))
    .order("business_date", { ascending: false });

  const cashSessions: CashSessionRow[] = (cashSessionRows ?? []).map((s) => ({
    id: s.id,
    businessDate: s.business_date,
    openingCash: Number(s.opening_cash),
    closingCash: s.closing_cash != null ? Number(s.closing_cash) : null,
    expectedCash: s.expected_cash != null ? Number(s.expected_cash) : null,
    variance: s.variance != null ? Number(s.variance) : null,
    status: s.status,
  }));

  const { data: cashMovementRows } = await supabase
    .from("cash_movements")
    .select(
      "id, direction, movement_type, amount, note, created_at, profiles(display_name), counterparty:counterparty_shop_id(name)",
    )
    .eq("shop_id", shopId)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false });

  const cashMovements: CashMovementRow[] = (cashMovementRows ?? []).map((m) => {
    const creator = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const counterparty = Array.isArray(m.counterparty) ? m.counterparty[0] : m.counterparty;
    return {
      id: m.id,
      createdAt: m.created_at,
      direction: m.direction,
      movementType: m.movement_type,
      amount: Number(m.amount),
      note: m.note,
      createdByName: (creator?.display_name as string | null) ?? null,
      counterpartyName: (counterparty?.name as string | null) ?? null,
    };
  });

  const items = normalizeSaleItems(saleItems ?? []);
  const variantRows = normalizeVariants(variants ?? []);
  const receiptRows = normalizeReceipts(receipts ?? []);

  const { byCategory, byNicotine } = computeSalesByCategory(items);

  return {
    salesSummary: computeSalesSummary(sales ?? []),
    paymentBreakdown: computePaymentBreakdown(sales ?? []),
    discounts: computeDiscounts(sales ?? []),
    saleDiscounts: computeSaleDiscounts(sales ?? []),
    loyaltySummary: computeLoyaltySummary(sales ?? []),
    salesDetail: computeSalesDetail(sales ?? [], items),
    revenueProfit: computeRevenueProfit(items),
    bestSellers: computeBestSellers(items),
    byCategory,
    byNicotine,
    lowStock: computeLowStock(variantRows),
    slowMovers: computeSlowMovers(variantRows, items),
    inventoryValue: computeInventoryValue(variantRows),
    projectedRevenueProfit: computeProjectedRevenueProfit(variantRows),
    supplierActivity: computeSupplierActivity(receiptRows),
    staffActivity: computeStaffActivity(staffSales ?? [], staffProfiles ?? []),
    expenses,
    expenseSummary: computeExpenseSummary(expenses),
    cashSessions,
    cashMovements,
    cashMovementsSummary: computeCashMovementsSummary(cashMovements),
  };
}
