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
  loyaltyUseCredit: boolean,
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
    p_loyalty_use_credit: loyaltyUseCredit,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  return { saleId: data as string };
}

export type LoyaltyCustomer = {
  customerId: string;
  name: string;
  phone: string;
  creditBalance: number;
  earnEnabled: boolean;
  redeemEnabled: boolean;
  rewardPercent: number;
};

type LoyaltyRow = {
  customer_id: string;
  name: string;
  phone: string;
  credit_balance: number;
  earn_enabled: boolean;
  redeem_enabled: boolean;
  reward_percent: number;
};

function mapLoyaltyRow(row: LoyaltyRow): LoyaltyCustomer {
  return {
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    creditBalance: Number(row.credit_balance ?? 0),
    earnEnabled: row.earn_enabled,
    redeemEnabled: row.redeem_enabled,
    rewardPercent: Number(row.reward_percent),
  };
}

export type LoyaltySearchResult = { error?: string; customers?: LoyaltyCustomer[] };

export async function searchLoyaltyCustomersAction(name: string): Promise<LoyaltySearchResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_loyalty_customers", {
    p_shop_id: profile.shopId,
    p_name: name,
  });
  if (error) return { error: error.message };

  return { customers: ((data ?? []) as LoyaltyRow[]).map(mapLoyaltyRow) };
}

export type LoyaltyRegisterResult = { error?: string; customer?: LoyaltyCustomer };

export async function registerLoyaltyCustomerAction(
  name: string,
  phone: string,
): Promise<LoyaltyRegisterResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("register_loyalty_customer", { p_shop_id: profile.shopId, p_name: name, p_phone: phone })
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Couldn't save that customer" };

  return { customer: mapLoyaltyRow(data as LoyaltyRow) };
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
