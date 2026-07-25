import type { createClient } from "@/lib/supabase/server";
import type { ShopMembership } from "@/lib/auth/get-current-profile";
import type { DateRange } from "./date-range";
import {
  computeSalesSummary,
  computePaymentBreakdown,
  computeRevenueProfit,
  computeBestSellers,
  computeSalesByCategory,
  computeLowStock,
  computeSlowMovers,
  computeInventoryValue,
  computeSupplierActivity,
  computeStaffActivity,
  type SaleItemRow,
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
};

export type AdminReportData = {
  salesSummary: ReturnType<typeof computeSalesSummary>;
  paymentBreakdown: ReturnType<typeof computePaymentBreakdown>;
  revenueProfit: ReturnType<typeof computeRevenueProfit>;
  bestSellers: ReturnType<typeof computeBestSellers>;
  byCategory: ReturnType<typeof computeSalesByCategory>["byCategory"];
  byNicotine: ReturnType<typeof computeSalesByCategory>["byNicotine"];
  supplierActivity: ReturnType<typeof computeSupplierActivity>;
  staffActivity: ReturnType<typeof computeStaffActivity>;
  inventoryPerBranch: BranchInventory[];
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
        .select("id, total, payment_method, created_at")
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
            "sale_id, variant_id, quantity, unit_price, unit_cost, variants(flavor, nicotine_mg, size, for_device, ohms, product_id, products(name, category))",
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
      return {
        sales: sales ?? [],
        saleItems: saleItems ?? [],
        receipts: receipts ?? [],
        staffSales: staffSales ?? [],
      };
    }),
  );

  const sales = salesPerShop.flatMap((r) => r.sales);
  const items = normalizeSaleItems(salesPerShop.flatMap((r) => r.saleItems));
  const receiptRows = normalizeReceipts(salesPerShop.flatMap((r) => r.receipts));
  const staffSales = salesPerShop.flatMap((r) => r.staffSales);

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
            "id, flavor, nicotine_mg, size, for_device, ohms, stock_qty, low_stock_threshold, cost, product_id, products(name, category, archived)",
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
      };
    }),
  );

  return {
    salesSummary: computeSalesSummary(sales),
    paymentBreakdown: computePaymentBreakdown(sales),
    revenueProfit: computeRevenueProfit(items),
    bestSellers: computeBestSellers(items),
    byCategory,
    byNicotine,
    supplierActivity: computeSupplierActivity(receiptRows),
    staffActivity: computeStaffActivity(staffSales, staffProfiles ?? []),
    inventoryPerBranch,
  };
}
