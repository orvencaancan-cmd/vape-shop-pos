import type { createClient } from "@/lib/supabase/server";
import type { ShopMembership } from "@/lib/auth/get-current-profile";
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

export function resolveSelectedBranch(
  branchParam: string | undefined,
  ownedShops: ShopMembership[],
): string {
  return branchParam && ownedShops.some((s) => s.shopId === branchParam) ? branchParam : "combined";
}

export type BranchInventory = {
  shopId: string;
  shopName: string;
  lowStock: ReturnType<typeof computeLowStock>;
  slowMovers: ReturnType<typeof computeSlowMovers>;
  inventoryValue: ReturnType<typeof computeInventoryValue>;
  projectedRevenueProfit: ReturnType<typeof computeProjectedRevenueProfit>;
};

export type AdminReportData = {
  salesSummary: ReturnType<typeof computeSalesSummary>;
  paymentBreakdown: ReturnType<typeof computePaymentBreakdown>;
  discounts: ReturnType<typeof computeDiscounts>;
  saleDiscounts: ReturnType<typeof computeSaleDiscounts>;
  loyaltySummary: ReturnType<typeof computeLoyaltySummary>;
  salesDetail: ReturnType<typeof computeSalesDetail>;
  revenueProfit: ReturnType<typeof computeRevenueProfit>;
  projectedRevenueProfit: ReturnType<typeof computeProjectedRevenueProfit>;
  bestSellers: ReturnType<typeof computeBestSellers>;
  byCategory: ReturnType<typeof computeSalesByCategory>["byCategory"];
  byNicotine: ReturnType<typeof computeSalesByCategory>["byNicotine"];
  supplierActivity: ReturnType<typeof computeSupplierActivity>;
  staffActivity: ReturnType<typeof computeStaffActivity>;
  inventoryPerBranch: BranchInventory[];
  expenses: ExpenseRow[];
  expenseSummary: ReturnType<typeof computeExpenseSummary>;
  cashSessions: CashSessionRow[];
  cashMovements: CashMovementRow[];
  cashMovementsSummary: ReturnType<typeof computeCashMovementsSummary>;
};

export async function fetchAdminReportData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownedShops: ShopMembership[],
  selectedBranch: string,
  { from, to }: DateRange,
): Promise<AdminReportData> {
  const salesShopIds =
    selectedBranch === "combined" ? ownedShops.map((s) => s.shopId) : [selectedBranch];

  // Sales-side metrics: concatenate raw rows across the selected shop(s)
  // before feeding compute.ts — those functions are shop-agnostic, so this
  // is all that's needed to produce a correctly "combined" result.
  const salesPerShop = await Promise.all(
    salesShopIds.map(async (shopId) => {
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
      let saleItems: unknown[] = [];
      if (saleIds.length) {
        const { data } = await supabase
          .from("sale_items")
          .select(
            "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, brand, category))",
          )
          .eq("shop_id", shopId)
          .in("sale_id", saleIds);
        saleItems = data ?? [];
      }
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
      const { data: expenseRows } = await supabase
        .from("expenses")
        .select("id, amount, category, note, created_at")
        .eq("shop_id", shopId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false });
      const { data: cashSessionRows } = await supabase
        .from("cash_sessions")
        .select("id, business_date, opening_cash, closing_cash, expected_cash, variance, status")
        .eq("shop_id", shopId)
        .gte("business_date", from.toISOString().slice(0, 10))
        .lt("business_date", to.toISOString().slice(0, 10))
        .order("business_date", { ascending: false });
      const { data: cashMovementRows } = await supabase
        .from("cash_movements")
        .select(
          "id, direction, movement_type, amount, note, created_at, profiles(display_name), counterparty:counterparty_shop_id(name)",
        )
        .eq("shop_id", shopId)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false });
      return {
        sales: sales ?? [],
        saleItems: saleItems ?? [],
        receipts: receipts ?? [],
        staffSales: staffSales ?? [],
        expenses: expenseRows ?? [],
        cashSessions: cashSessionRows ?? [],
        cashMovements: cashMovementRows ?? [],
      };
    }),
  );

  const sales = salesPerShop.flatMap((r) => r.sales);
  const items = normalizeSaleItems(salesPerShop.flatMap((r) => r.saleItems));
  const receiptRows = normalizeReceipts(salesPerShop.flatMap((r) => r.receipts));
  const staffSales = salesPerShop.flatMap((r) => r.staffSales);
  const expenses: ExpenseRow[] = salesPerShop.flatMap((r) =>
    r.expenses.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      category: e.category,
      note: e.note,
      createdAt: e.created_at,
    })),
  );

  // Cash sessions/movements are transactional per-event rows, just like
  // sales -- no blending-across-branches concern the way inventory has
  // (two branches can't collide on the same day/movement the way two
  // identically-named products could), so a Branch column on one shared
  // table is enough; no separate per-branch subsection needed.
  const shopNameById = new Map(ownedShops.map((s) => [s.shopId, s.shopName]));
  const cashSessions: CashSessionRow[] = salesPerShop.flatMap((r, i) => {
    const shopName = shopNameById.get(salesShopIds[i]) ?? "";
    return r.cashSessions.map((s) => ({
      id: s.id,
      businessDate: s.business_date,
      openingCash: Number(s.opening_cash),
      closingCash: s.closing_cash != null ? Number(s.closing_cash) : null,
      expectedCash: s.expected_cash != null ? Number(s.expected_cash) : null,
      variance: s.variance != null ? Number(s.variance) : null,
      status: s.status,
      shopName,
    }));
  });
  const cashMovements: CashMovementRow[] = salesPerShop.flatMap((r, i) => {
    const shopName = shopNameById.get(salesShopIds[i]) ?? "";
    return r.cashMovements.map((m) => {
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
        shopName,
      };
    });
  });

  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("shop_id", salesShopIds);

  const { byCategory, byNicotine } = computeSalesByCategory(items);

  // Inventory-side metrics are never blended across branches -- two
  // branches can have identically-named products, so a merged list would
  // be misleading. Always fetch and return every owned branch, regardless
  // of the sales-side branch selection.
  const inventoryPerBranch: BranchInventory[] = await Promise.all(
    ownedShops.map(async (s) => {
      const [{ data: variants }, { data: branchSales }] = await Promise.all([
        supabase
          .from("variants")
          .select(
            "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, price, product_id, products(name, category, archived)",
          )
          .eq("shop_id", s.shopId),
        supabase
          .from("sales")
          .select("id")
          .eq("shop_id", s.shopId)
          .gte("created_at", from.toISOString())
          .lt("created_at", to.toISOString())
          .is("voided_at", null),
      ]);

      const branchSaleIds = (branchSales ?? []).map((row) => row.id);
      const { data: branchSaleItems } = branchSaleIds.length
        ? await supabase
            .from("sale_items")
            .select(
              "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, category))",
            )
            .eq("shop_id", s.shopId)
            .in("sale_id", branchSaleIds)
        : { data: [] as SaleItemRow[] };

      const variantRows = normalizeVariants(variants ?? []);
      const branchItems = normalizeSaleItems(branchSaleItems ?? []);

      return {
        shopId: s.shopId,
        shopName: s.shopName,
        lowStock: computeLowStock(variantRows),
        slowMovers: computeSlowMovers(variantRows, branchItems),
        inventoryValue: computeInventoryValue(variantRows),
        projectedRevenueProfit: computeProjectedRevenueProfit(variantRows),
      };
    }),
  );

  // Top-level Projected revenue & profit follows the same combined/selected
  // scoping as the sales-side numbers above -- unlike Low stock/Slow movers/
  // Inventory value (which stay per-branch only, since two branches can
  // carry identically-named products and a merged product list would be
  // misleading), this is just a scalar sum with no naming collision risk,
  // so summing it across branches for "combined" is safe. Derived from the
  // already-fetched inventoryPerBranch instead of a second query.
  const projectedRevenueProfit =
    selectedBranch === "combined"
      ? inventoryPerBranch.reduce(
          (acc, b) => ({
            revenue: acc.revenue + b.projectedRevenueProfit.revenue,
            cost: acc.cost + b.projectedRevenueProfit.cost,
            profit: acc.profit + b.projectedRevenueProfit.profit,
          }),
          { revenue: 0, cost: 0, profit: 0 },
        )
      : (inventoryPerBranch.find((b) => b.shopId === selectedBranch)?.projectedRevenueProfit ?? {
          revenue: 0,
          cost: 0,
          profit: 0,
        });

  return {
    salesSummary: computeSalesSummary(sales),
    paymentBreakdown: computePaymentBreakdown(sales),
    discounts: computeDiscounts(sales),
    saleDiscounts: computeSaleDiscounts(sales),
    loyaltySummary: computeLoyaltySummary(sales),
    salesDetail: computeSalesDetail(sales, items),
    revenueProfit: computeRevenueProfit(items),
    projectedRevenueProfit,
    bestSellers: computeBestSellers(items),
    byCategory,
    byNicotine,
    supplierActivity: computeSupplierActivity(receiptRows),
    staffActivity: computeStaffActivity(staffSales, staffProfiles ?? []),
    inventoryPerBranch,
    expenses,
    expenseSummary: computeExpenseSummary(expenses),
    cashSessions,
    cashMovements,
    cashMovementsSummary: computeCashMovementsSummary(cashMovements),
  };
}
