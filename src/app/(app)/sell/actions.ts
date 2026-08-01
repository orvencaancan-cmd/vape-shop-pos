"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type SaleResult = { error?: string; saleId?: string };

export async function recordSaleAction(
  cart: { variantId: string; quantity: number }[],
  paymentMethod: "cash" | "gcash",
  discountAmount: number,
  discountReason: string | null,
  loyaltyPhone: string | null,
  loyaltyName: string | null,
  loyaltyRedeemAmount: number,
): Promise<SaleResult> {
  if (cart.length === 0) {
    return { error: "Cart is empty" };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_sale", {
    p_shop_id: profile.shopId,
    items: cart.map((item) => ({
      variant_id: item.variantId,
      quantity: item.quantity,
    })),
    p_payment_method: paymentMethod,
    p_discount_amount: discountAmount,
    p_discount_reason: discountReason,
    p_loyalty_phone: loyaltyPhone,
    p_loyalty_name: loyaltyName,
    p_loyalty_redeem: loyaltyRedeemAmount,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  return { saleId: data as string };
}

export type LoyaltyLookupResult = {
  error?: string;
  customer?: {
    customerId: string | null;
    name: string | null;
    creditBalance: number;
    earnEnabled: boolean;
    redeemEnabled: boolean;
    rewardPercent: number;
  };
};

export async function lookupLoyaltyCustomerAction(phone: string): Promise<LoyaltyLookupResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  type LoyaltyLookupRow = {
    customer_id: string | null;
    name: string | null;
    credit_balance: number;
    earn_enabled: boolean;
    redeem_enabled: boolean;
    reward_percent: number;
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("lookup_loyalty_customer", { p_shop_id: profile.shopId, p_phone: phone })
    .maybeSingle();
  if (error) return { error: error.message };
  const row = data as LoyaltyLookupRow | null;
  if (!row) return { error: "Loyalty program is not enabled for this branch" };

  return {
    customer: {
      customerId: row.customer_id,
      name: row.name,
      creditBalance: Number(row.credit_balance ?? 0),
      earnEnabled: row.earn_enabled,
      redeemEnabled: row.redeem_enabled,
      rewardPercent: Number(row.reward_percent),
    },
  };
}

export type VoidResult = { error?: string };

export async function voidSaleAction(saleId: string): Promise<VoidResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", {
    p_shop_id: profile.shopId,
    p_sale_id: saleId,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {};
}
