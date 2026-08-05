import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { isSaleActive } from "@/lib/sale-status";
import { SellScreen } from "./sell-screen";

export default async function SellPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.inAdminOverview || (profile.shop.archived && profile.role === "owner")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select(
      "loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent, sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at",
    )
    .eq("id", profile.shopId)
    .single();

  const { data: variants } = await supabase
    .from("variants")
    .select(
      "id, product_id, flavor, nicotine_mg, size, for_device, ohms, price, stock_qty, products(name, brand, category, archived)",
    )
    .eq("shop_id", profile.shopId)
    .order("created_at");

  const items = (variants ?? [])
    .map((v) => {
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      if (!product || product.archived) return null;
      return {
        id: v.id as string,
        productId: v.product_id as string,
        productName: product.name as string,
        brand: (product.brand as string | null) ?? null,
        category: product.category as "ejuice" | "accessory",
        label:
          [
            v.flavor,
            v.nicotine_mg != null ? `${v.nicotine_mg}mg` : null,
            v.size,
            v.for_device ? `For ${v.for_device}` : null,
            v.ohms != null ? `${v.ohms}Ω` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Default",
        price: Number(v.price),
        stockQty: v.stock_qty as number,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const saleActive = isSaleActive({
    saleEnabled: shop?.sale_enabled ?? false,
    saleStartsAt: shop?.sale_starts_at ?? null,
    saleEndsAt: shop?.sale_ends_at ?? null,
  });

  let saleProductIds: string[] = [];
  if (shop?.sale_scope === "items") {
    const { data: saleProductRows } = await supabase
      .from("sale_promo_products")
      .select("product_id")
      .eq("shop_id", profile.shopId);
    saleProductIds = (saleProductRows ?? []).map((r) => r.product_id as string);
  }

  // "Today" only, calendar-day aligned (matches the same boundary logic used
  // for Reports/Dashboard) -- previous days' sales don't belong on this
  // screen, which is for what's happening at the register right now.
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const { data: recentSalesRaw } = await supabase
    .from("sales")
    .select(
      "id, total, payment_method, discount_amount, discount_reason, sale_discount_amount, created_at, created_by, voided_at, voided_reason, profiles!sales_created_by_fkey(display_name)",
    )
    .eq("shop_id", profile.shopId)
    .gte("created_at", todayStart.toISOString())
    .lt("created_at", todayEnd.toISOString())
    .order("created_at", { ascending: false });

  const saleIds = (recentSalesRaw ?? []).map((s) => s.id);
  const { data: saleItemsRaw } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select(
          "sale_id, variant_id, quantity, unit_price, variants(flavor, nicotine_mg, size, for_device, ohms, products(name, brand))",
        )
        .eq("shop_id", profile.shopId)
        .in("sale_id", saleIds)
    : { data: [] };

  const linesBySaleId = new Map<
    string,
    { variantId: string; item: string; quantity: number; price: number }[]
  >();
  for (const row of saleItemsRaw ?? []) {
    const variant = Array.isArray(row.variants) ? row.variants[0] : row.variants;
    const product = variant ? (Array.isArray(variant.products) ? variant.products[0] : variant.products) : null;
    const label =
      [
        variant?.flavor,
        variant?.nicotine_mg != null ? `${variant.nicotine_mg}mg` : null,
        variant?.size,
        variant?.for_device ? `For ${variant.for_device}` : null,
        variant?.ohms != null ? `${variant.ohms}Ω` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Default";
    const line = {
      variantId: row.variant_id as string,
      item: `${product?.brand ? `${product.brand} — ` : ""}${product?.name ?? "Unknown product"} — ${label}`,
      quantity: row.quantity as number,
      price: Number(row.unit_price) * (row.quantity as number),
    };
    const saleId = row.sale_id as string;
    if (!linesBySaleId.has(saleId)) linesBySaleId.set(saleId, []);
    linesBySaleId.get(saleId)!.push(line);
  }

  const recentSales = (recentSalesRaw ?? []).map((s) => {
    const creator = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return {
      id: s.id as string,
      total: Number(s.total),
      paymentMethod: s.payment_method as "cash" | "gcash",
      discountAmount: Number(s.discount_amount),
      discountReason: s.discount_reason as string | null,
      saleDiscountAmount: Number(s.sale_discount_amount),
      createdAt: s.created_at as string,
      createdByName: (creator?.display_name as string | null) ?? null,
      voidedAt: s.voided_at as string | null,
      voidedReason: s.voided_reason as string | null,
      canVoid: !s.voided_at && (profile.role === "owner" || s.created_by === profile.id),
      lines: linesBySaleId.get(s.id as string) ?? [],
    };
  });

  return (
    <main className="animate-fade-in-up">
      <SellScreen
        shopName={profile.shop.name}
        variants={items}
        recentSales={recentSales}
        currentUserName={profile.displayName}
        loyaltyEarnEnabled={shop?.loyalty_earn_enabled ?? false}
        loyaltyRedeemEnabled={shop?.loyalty_redeem_enabled ?? false}
        loyaltyRewardPercent={Number(shop?.loyalty_reward_percent ?? 0)}
        saleActive={saleActive}
        salePercent={Number(shop?.sale_percent ?? 0)}
        saleScope={(shop?.sale_scope as "branch" | "items") ?? "branch"}
        saleProductIds={saleProductIds}
      />
    </main>
  );
}
