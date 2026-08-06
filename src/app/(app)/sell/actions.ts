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

export async function voidSaleAction(saleId: string, reason: string): Promise<VoidResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", {
    p_shop_id: profile.shopId,
    p_sale_id: saleId,
    p_reason: reason,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return {};
}

export type CashActionResult = { error?: string };

export async function openCashSessionAction(
  openingCash: number,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_cash_session", {
    p_shop_id: profile.shopId,
    p_opening_cash: openingCash,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  return {};
}

export async function closeCashSessionAction(
  closingCash: number,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_cash_session", {
    p_shop_id: profile.shopId,
    p_closing_cash: closingCash,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  return {};
}

// A Cash Out tagged branch_transfer/floating_pool no longer debits this
// branch directly -- it creates a pending transfer (create_cash_transfer)
// that stays counted here until the other side receives it. Cash In is
// 'general' only now: receiving a transfer happens through
// receiveCashTransferAction, not by manually asserting a source here.
export async function recordCashMovementAction(
  direction: "in" | "out",
  amount: number,
  movementType: "general" | "branch_transfer" | "floating_pool",
  counterpartyShopId: string | null,
  note: string | null,
): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  if (movementType !== "general") {
    if (direction !== "out") {
      return { error: "Receive incoming cash from the Incoming cash section instead" };
    }
    const { error } = await supabase.rpc("create_cash_transfer", {
      p_source_type: "branch",
      p_source_shop_id: profile.shopId,
      p_destination_type: movementType === "floating_pool" ? "floating" : "branch",
      p_destination_shop_id: movementType === "branch_transfer" ? counterpartyShopId : null,
      p_amount: amount,
      p_note: note,
    });
    if (error) return { error: error.message };
    revalidatePath("/sell");
    revalidatePath("/cash-flow");
    return {};
  }

  const { error } = await supabase.rpc("record_cash_movement", {
    p_shop_id: profile.shopId,
    p_direction: direction,
    p_amount: amount,
    p_movement_type: "general",
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  return {};
}

export async function receiveCashTransferAction(transferId: string): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_cash_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/cash-flow");
  revalidatePath("/dashboard");
  return {};
}

export async function cancelCashTransferAction(transferId: string): Promise<CashActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cash_transfer", { p_transfer_id: transferId });
  if (error) return { error: error.message };

  revalidatePath("/sell");
  revalidatePath("/cash-flow");
  return {};
}
